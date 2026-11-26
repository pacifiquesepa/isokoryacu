import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import {
  createMerchantPayoutRequest,
  MerchantPayoutNotAvailableError,
} from "@/lib/data-access/merchant-finance";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkProductMutationLimit } from "@/lib/rate-limit";
import { merchantPayoutRequestSchema } from "@/lib/validation/merchant-finance";

export async function POST(request: Request) {
  try {
    const seller = await requireMerchantWorkspaceUser("canManageFinancialProfile");
    const limit = await checkProductMutationLimit(seller.id);
    if (!limit.allowed) return rateLimitResponse(limit, "payout request");
    const body = await parseJsonRequest(request, merchantPayoutRequestSchema);
    if (!body.success) return body.response;
    const payout = await createMerchantPayoutRequest(
      seller,
      body.data.amount,
      body.data.destinationType,
    );
    return Response.json(payout, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MerchantPayoutNotAvailableError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to request payout", "Payout request could not be submitted");
  }
}
