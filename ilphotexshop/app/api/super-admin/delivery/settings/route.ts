import { requireUserRole } from "@/lib/authorization";
import { updateDeliverySettings } from "@/lib/data-access/delivery-settings";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkPaymentAccountMutationLimit } from "@/lib/rate-limit";
import { deliverySettingsSchema } from "@/lib/validation/orders";

export async function PATCH(request: Request) {
  try {
    const admin = await requireUserRole("super_admin");
    const limit = await checkPaymentAccountMutationLimit(admin.id);
    if (!limit.allowed) return rateLimitResponse(limit, "delivery settings update");
    const body = await parseJsonRequest(request, deliverySettingsSchema);
    if (!body.success) return body.response;

    const settings = await updateDeliverySettings(body.data);
    return Response.json(
      { settings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to update delivery settings",
      "Delivery settings could not be saved",
    );
  }
}
