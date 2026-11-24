import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { publishDueScheduledProducts } from "@/lib/data-access/products";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const expectedHash = createHash("sha256").update(secret).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) {
    return Response.json(
      { error: "Scheduled publishing is not configured" },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const published = await publishDueScheduledProducts();
    if (published > 0) {
      revalidatePath("/");
      revalidatePath("/super-admin/products/scheduled-products");
    }
    return Response.json(
      { published },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not publish scheduled products", error);
    return Response.json(
      { error: "Scheduled products could not be published" },
      { status: 500 },
    );
  }
}
