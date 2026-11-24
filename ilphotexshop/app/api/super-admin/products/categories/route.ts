import { Prisma } from "@prisma/client";
import { requireUserRole } from "@/lib/authorization";
import {
  createProductCategory,
  deleteProductCategory,
  ProductCategoryInUseError,
  updateProductCategory,
} from "@/lib/data-access/super-admin-product-management";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  productCategoryCreateSchema,
  productCategoryUpdateSchema,
} from "@/lib/validation/products";
import { z } from "zod";

function categoryConflictResponse(error: unknown) {
  if (error instanceof ProductCategoryInUseError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return Response.json(
      { error: "A category with this slug or name already exists" },
      { status: 409 },
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return Response.json(
      { error: "A category with products or subcategories cannot be deleted" },
      { status: 409 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(request, productCategoryCreateSchema);
    if (!body.success) return body.response;
    const category = await createProductCategory(body.data);
    return Response.json(category, { status: 201 });
  } catch (error) {
    const conflict = categoryConflictResponse(error);
    if (conflict) return conflict;
    return apiErrorResponse(error, "Failed to create product category", "Category could not be created");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(request, productCategoryUpdateSchema);
    if (!body.success) return body.response;
    const updated = await updateProductCategory(body.data);
    if (!updated) return Response.json({ error: "Category not found" }, { status: 404 });
    return Response.json(body.data);
  } catch (error) {
    const conflict = categoryConflictResponse(error);
    if (conflict) return conflict;
    return apiErrorResponse(error, "Failed to update product category", "Category could not be updated");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUserRole("super_admin");
    const body = await parseJsonRequest(
      request,
      z.object({ slug: productCategoryUpdateSchema.shape.slug }).strict(),
    );
    if (!body.success) return body.response;
    const deleted = await deleteProductCategory(body.data.slug);
    if (!deleted) return Response.json({ error: "Category not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    const conflict = categoryConflictResponse(error);
    if (conflict) return conflict;
    return apiErrorResponse(error, "Failed to delete product category", "Category could not be deleted");
  }
}
