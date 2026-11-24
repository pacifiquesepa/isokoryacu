import { requireUserRole } from "@/lib/authorization";
import {
  MerchantPayoutConflictError,
  reviewMerchantFinancialChangeRequest,
} from "@/lib/data-access/merchant-finance";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { merchantFinancialChangeReviewSchema } from "@/lib/validation/merchant-finance";
import { orderIdSchema } from "@/lib/validation/orders";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireUserRole("super_admin");
    const { id } = await params;
    const requestId = orderIdSchema.safeParse(id);
    if (!requestId.success) {
      return Response.json({ error: "Invalid request ID" }, { status: 400 });
    }
    const body = await parseJsonRequest(request, merchantFinancialChangeReviewSchema);
    if (!body.success) return body.response;
    const result = await reviewMerchantFinancialChangeRequest(
      admin.id,
      requestId.data,
      body.data,
    );
    if (!result) return Response.json({ error: "Request not found" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    if (error instanceof MerchantPayoutConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to review financial change", "Request could not be reviewed");
  }
}
