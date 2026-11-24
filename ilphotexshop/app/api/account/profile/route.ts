import { updateCustomerProfile } from "@/lib/data-access/customer-profile";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkCustomerProfileMutationLimit } from "@/lib/rate-limit";
import { updateUserProfileSchema } from "@/lib/validation/users";

export async function PATCH(request: Request) {
  try {
    const customer = await requireUserRole("customer");
    const limit = await checkCustomerProfileMutationLimit(customer.id);
    if (!limit.allowed) return rateLimitResponse(limit, "customer profile");

    const body = await parseJsonRequest(request, updateUserProfileSchema);
    if (!body.success) return body.response;

    const profile = await updateCustomerProfile(customer, body.data);
    if (!profile) {
      return Response.json(
        { error: "Customer account is no longer available" },
        { status: 409 },
      );
    }

    return Response.json(
      { profile },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Remaining": String(limit.remaining),
        },
      },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to update customer profile",
      "Profile could not be updated",
    );
  }
}
