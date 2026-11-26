import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { adjustProductStock, InsufficientProductStockError } from "@/lib/data-access/inventory";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkProductMutationLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { merchantStockAdjustmentSchema } from "@/lib/validation/merchant-inventory";

export async function POST(request: Request) {
  try {
    const seller = await requireMerchantWorkspaceUser("canManageProducts");
    const limit = await checkProductMutationLimit(seller.id);
    if (!limit.allowed) return rateLimitResponse(limit, "inventory adjustment");
    const body = await parseJsonRequest(request, merchantStockAdjustmentSchema);
    if (!body.success) return body.response;

    const adjusted = await prisma.$transaction(async (transaction) => {
      const ownedProduct = await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "Product"
        WHERE "id" = ${body.data.productId}
          AND "ownerId" = ${seller.id}
        FOR UPDATE
      `;
      if (!ownedProduct.length) return false;
      return adjustProductStock(transaction, {
        productId: body.data.productId,
        actorId: seller.id,
        quantity: body.data.quantity,
        reason: body.data.reason,
      });
    });
    if (!adjusted) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InsufficientProductStockError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to adjust inventory", "Inventory could not be adjusted");
  }
}
