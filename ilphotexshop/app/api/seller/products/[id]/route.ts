import {
  deleteManagedProduct,
  isProductSkuUniqueConstraintError,
  InvalidProductScheduleError,
  InvalidProductSubcategoryError,
  InvalidProductPricingError,
  InvalidProductCategoryError,
  updateManagedProduct,
} from "@/lib/data-access/products";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  getProductFormFields,
  readProductFormData,
  readProductImageUploads,
  type UploadedProductImage,
} from "@/lib/http/product-image-upload";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkProductMutationLimit } from "@/lib/rate-limit";
import {
  productPublicationSchema,
  productIdSchema,
  updateProductSchema,
} from "@/lib/validation/products";

type ProductRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ProductRouteContext) {
  try {
    const actor = await requireUserRole(["seller", "admin", "super_admin"]);
    const { id } = await context.params;
    const parsedId = productIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const limit = await checkProductMutationLimit(actor.id);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "product write");
    }

    let product;
    if (
      request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("multipart/form-data;")
    ) {
      const formResult = await readProductFormData(request);
      if (!formResult.ok) {
        return Response.json(
          { error: formResult.error },
          { status: formResult.status },
        );
      }
      const fields = getProductFormFields(formResult.form);
      const publication = productPublicationSchema.safeParse(fields.publication);
      if (!publication.success) {
        return Response.json(
          { error: "Invalid publication settings", details: publication.error.flatten() },
          { status: 400 },
        );
      }

      const metadata = updateProductSchema.safeParse({
        ...fields.metadata,
        ...(fields.imageSource === "url" ? { image: fields.image } : {}),
      });
      if (!metadata.success) {
        return Response.json(
          { error: "Invalid product details", details: metadata.error.flatten() },
          { status: 400 },
        );
      }

      let imageChange:
        | { type: "keep" }
        | { type: "url"; url: string }
        | { type: "upload"; images: UploadedProductImage[] };
      if (fields.imageSource === "url") {
        imageChange = { type: "url", url: fields.image };
      } else if (fields.imageSource === "upload") {
        const imageEntries = formResult.form.getAll("imageFiles");
        if (imageEntries.length === 0 && formResult.form.has("imageFile")) {
          imageEntries.push(formResult.form.get("imageFile")!);
        }
        const images = await readProductImageUploads(imageEntries, false);
        if (!images.ok) {
          return Response.json({ error: images.error }, { status: 400 });
        }
        imageChange = images.images.length
          ? { type: "upload", images: images.images }
          : { type: "keep" };
      } else {
        return Response.json({ error: "Choose an image source" }, { status: 400 });
      }

      product = await updateManagedProduct(
        actor,
        parsedId.data,
        metadata.data,
        imageChange,
        publication.data,
      );
    } else {
      const body = await parseJsonRequest(request, updateProductSchema);
      if (!body.success) return body.response;
      product = await updateManagedProduct(actor, parsedId.data, body.data);
    }
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json(product, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InvalidProductPricingError) {
      return Response.json(
        { error: "Previous price must be greater than current price" },
        { status: 400 },
      );
    }
    if (
      error instanceof InvalidProductScheduleError ||
      error instanceof InvalidProductSubcategoryError ||
      error instanceof InvalidProductCategoryError
    ) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (isProductSkuUniqueConstraintError(error)) {
      return Response.json({ error: "That SKU is already in use" }, { status: 409 });
    }
    return apiErrorResponse(
      error,
      "Failed to update seller product",
      "Product could not be updated",
    );
  }
}

export async function DELETE(_request: Request, context: ProductRouteContext) {
  try {
    const actor = await requireUserRole(["seller", "admin", "super_admin"]);
    const { id } = await context.params;
    const parsedId = productIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const limit = await checkProductMutationLimit(actor.id);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "product write");
    }

    const deleted = await deleteManagedProduct(actor, parsedId.data);
    if (!deleted) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to delete seller product",
      "Product could not be deleted",
    );
  }
}
