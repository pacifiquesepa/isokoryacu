import {
  createSellerProduct,
  createSellerProductWithImages,
  getManagedProducts,
  InvalidProductCategoryError,
  isProductSkuUniqueConstraintError,
  InvalidProductScheduleError,
  InvalidProductSubcategoryError,
} from "@/lib/data-access/products";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import {
  getProductFormFields,
  readProductFormData,
  readProductImageUploads,
} from "@/lib/http/product-image-upload";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import {
  checkProductMutationLimit,
  checkSellerProductReadLimit,
} from "@/lib/rate-limit";
import {
  createProductMetadataSchema,
  createProductSchema,
  listProductsQuerySchema,
  productPublicationSchema,
} from "@/lib/validation/products";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  try {
    const user = await requireUserRole(["seller", "admin", "super_admin"]);
    const query = listProductsQuerySchema.safeParse(
      Object.fromEntries(requestUrl.searchParams.entries()),
    );
    if (!query.success) {
      return Response.json(
        { error: "Invalid product query", details: query.error.flatten() },
        { status: 400 },
      );
    }

    const limit = await checkSellerProductReadLimit(user.id);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "seller product");
    }

    const result = await getManagedProducts(user, query.data);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to load seller products",
      "Seller products are temporarily unavailable",
    );
  }
}

export async function POST(request: Request) {
  try {
    const seller = await requireUserRole("seller");
    const limit = await checkProductMutationLimit(seller.id);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "product write");
    }

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
      if (fields.imageSource === "upload") {
        const metadata = createProductMetadataSchema.safeParse(fields.metadata);
        if (!metadata.success) {
          return Response.json(
            { error: "Invalid product details", details: metadata.error.flatten() },
            { status: 400 },
          );
        }
        const imageEntries = formResult.form.getAll("imageFiles");
        if (imageEntries.length === 0 && formResult.form.has("imageFile")) {
          imageEntries.push(formResult.form.get("imageFile")!);
        }
        const images = await readProductImageUploads(imageEntries, true);
        if (!images.ok) {
          return Response.json({ error: images.error }, { status: 400 });
        }
        const product = await createSellerProductWithImages(
          seller,
          metadata.data,
          images.images,
          publication.data,
        );
        return Response.json(product, {
          status: 201,
          headers: { "Cache-Control": "no-store" },
        });
      }
      if (fields.imageSource !== "url") {
        return Response.json({ error: "Choose an image source" }, { status: 400 });
      }

      const body = createProductSchema.safeParse({
        ...fields.metadata,
        image: fields.image,
      });
      if (!body.success) {
        return Response.json(
          { error: "Invalid product details", details: body.error.flatten() },
          { status: 400 },
        );
      }
      const product = await createSellerProduct(seller, body.data, publication.data);
      return Response.json(product, {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const body = await parseJsonRequest(request, createProductSchema);
    if (!body.success) return body.response;

    const product = await createSellerProduct(seller, body.data);
    return Response.json(product, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InvalidProductScheduleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof InvalidProductSubcategoryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof InvalidProductCategoryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (isProductSkuUniqueConstraintError(error)) {
      return Response.json({ error: "That SKU is already in use" }, { status: 409 });
    }
    return apiErrorResponse(
      error,
      "Failed to create seller product",
      "Product could not be created",
    );
  }
}
