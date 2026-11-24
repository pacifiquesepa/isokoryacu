import { requireUserRole } from "@/lib/authorization";
import {
  createMerchantFinancialChangeRequest,
  MerchantFinancialChangeConflictError,
} from "@/lib/data-access/merchant-finance";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkSellerProfileMutationLimit } from "@/lib/rate-limit";
import { merchantFinancialChangeSchema } from "@/lib/validation/merchant-finance";

export async function POST(request: Request) {
  try {
    const seller = await requireUserRole("seller");
    const limit = await checkSellerProfileMutationLimit(seller.id);
    if (!limit.allowed) return rateLimitResponse(limit, "payout account change");
    const body = await parseJsonRequest(request, merchantFinancialChangeSchema);
    if (!body.success) return body.response;
    const change = await createMerchantFinancialChangeRequest(seller, body.data);
    return Response.json(change, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MerchantFinancialChangeConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to request payout account change", "Payout account change could not be submitted");
  }
}
