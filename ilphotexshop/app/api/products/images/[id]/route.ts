import { getAuthenticatedUser } from "@/lib/authorization";
import {
  getProductImageRecord,
  isProductImageUsedByOrder,
} from "@/lib/data-access/products";
import { apiErrorResponse } from "@/lib/http/api-error-response";

const imageIdPattern = /^[a-f0-9-]{36}$/i;
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!imageIdPattern.test(id)) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const [image, actor] = await Promise.all([
      getProductImageRecord(id),
      getAuthenticatedUser(),
    ]);
    if (!image || !allowedImageTypes.has(image.mimeType)) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const product = image.product;
    const isPrivileged =
      actor?.role === "admin" || actor?.role === "super_admin";
    const isOwner = Boolean(actor && product?.ownerId === actor.id);
    const orderUse =
      actor && (await isProductImageUsedByOrder(id, actor.id));
    if (!product?.isPublished && !isPrivileged && !isOwner && !orderUse) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    return new Response(new Uint8Array(image.imageData), {
      headers: {
        "Cache-Control": product?.isPublished
          ? "public, max-age=300, stale-while-revalidate=3600"
          : "private, no-store",
        "Content-Type": image.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to load product image",
      "Product image is temporarily unavailable",
    );
  }
}
