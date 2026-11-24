import { getMerchantShopMediaBySlug } from "@/lib/data-access/merchant-shop";
import { apiErrorResponse } from "@/lib/http/api-error-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!/^[a-z0-9-]{1,220}$/.test(slug)) {
      return new Response(null, { status: 404 });
    }

    const kind = new URL(request.url).searchParams.get("type");
    if (kind !== "logo" && kind !== "banner") {
      return new Response(null, { status: 404 });
    }

    const media = await getMerchantShopMediaBySlug(slug, kind);
    if (!media) return new Response(null, { status: 404 });

    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": media.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to load public shop image",
      "Shop image could not be loaded",
    );
  }
}
