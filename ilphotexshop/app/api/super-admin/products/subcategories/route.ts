import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  deleteProductSubcategory,
  InvalidProductCategorySelectionError,
  ProductSubcategoryInUseError,
  setProductSubcategoryStatus,
  upsertProductSubcategory,
} from "@/lib/data-access/super-admin-product-management";
import {
  createProductSubcategorySchema,
  productSubcategorySchema,
} from "@/lib/validation/products";
import { Prisma } from "@prisma/client";
import { z } from "zod";

function subcategoryConflictResponse(error: unknown) {
  if (error instanceof ProductSubcategoryInUseError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return Response.json(
      { error: "A subcategory with this slug already exists in the selected category" },
      { status: 409 },
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return Response.json(
      { error: "Remove product assignments before deleting this subcategory" },
      { status: 409 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(request, createProductSubcategorySchema);
    if (!body.success) return body.response;
    const subcategory = await upsertProductSubcategory(body.data);
    return Response.json(subcategory);
  } catch (error) {
    const conflict = subcategoryConflictResponse(error);
    if (conflict) return conflict;
    if (error instanceof InvalidProductCategorySelectionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiErrorResponse(error, "Failed to save subcategory", "Subcategory could not be saved");
  }
}

export async function PUT(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(request, productSubcategorySchema);
    if (!body.success) return body.response;
    if (!body.data.id) {
      return Response.json({ error: "Subcategory ID is required" }, { status: 400 });
    }
    const subcategory = await upsertProductSubcategory(body.data);
    if (!subcategory) return Response.json({ error: "Subcategory not found" }, { status: 404 });
    return Response.json(subcategory);
  } catch (error) {
    const conflict = subcategoryConflictResponse(error);
    if (conflict) return conflict;
    if (error instanceof InvalidProductCategorySelectionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiErrorResponse(error, "Failed to update subcategory", "Subcategory could not be updated");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(
      request,
      z.object({ id: z.string().min(1), isActive: z.boolean() }).strict(),
    );
    if (!body.success) return body.response;
    const changed = await setProductSubcategoryStatus(body.data.id, body.data.isActive);
    if (!changed) return Response.json({ error: "Subcategory not found" }, { status: 404 });
    return Response.json(body.data);
  } catch (error) {
    return apiErrorResponse(error, "Failed to update subcategory", "Subcategory could not be updated");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(
      request,
      z.object({ id: z.string().trim().min(1).max(100) }).strict(),
    );
    if (!body.success) return body.response;
    const deleted = await deleteProductSubcategory(body.data.id);
    if (!deleted) return Response.json({ error: "Subcategory not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    const conflict = subcategoryConflictResponse(error);
    if (conflict) return conflict;
    return apiErrorResponse(error, "Failed to delete subcategory", "Subcategory could not be deleted");
  }
}
