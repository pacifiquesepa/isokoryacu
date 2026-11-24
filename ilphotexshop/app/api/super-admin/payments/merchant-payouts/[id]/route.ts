import { requireUserRole } from "@/lib/authorization";
import {
  MerchantPayoutConflictError,
  MerchantPayoutNotAvailableError,
  reviewMerchantPayout,
} from "@/lib/data-access/merchant-finance";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { merchantPayoutReviewSchema } from "@/lib/validation/merchant-finance";
import { orderIdSchema } from "@/lib/validation/orders";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireUserRole("super_admin");
    const { id } = await params;
    const payoutId = orderIdSchema.safeParse(id);
    if (!payoutId.success) {
      return Response.json({ error: "Invalid payout ID" }, { status: 400 });
    }
    const body = await parseJsonRequest(request, merchantPayoutReviewSchema);
    if (!body.success) return body.response;
    const payout = await reviewMerchantPayout(admin.id, payoutId.data, body.data);
    if (!payout) return Response.json({ error: "Payout not found" }, { status: 404 });
    return Response.json(payout);
  } catch (error) {
    if (error instanceof MerchantPayoutConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof MerchantPayoutNotAvailableError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to process payout", "Payout could not be processed");
  }
}
