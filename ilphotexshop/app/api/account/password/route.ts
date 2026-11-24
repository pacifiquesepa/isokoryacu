import bcrypt from "bcryptjs";
import { requireUserRole } from "@/lib/authorization";
import {
  getCustomerPasswordHash,
  updateCustomerPassword,
} from "@/lib/data-access/customer-profile";
import { revokeUserSecuritySessions } from "@/lib/data-access/super-admin-security";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkCustomerPasswordMutationLimit } from "@/lib/rate-limit";
import { changeCustomerPasswordSchema } from "@/lib/validation/users";

export async function PATCH(request: Request) {
  try {
    const customer = await requireUserRole("customer");
    const limit = await checkCustomerPasswordMutationLimit(customer.id);
    if (!limit.allowed) return rateLimitResponse(limit, "customer password");

    const body = await parseJsonRequest(request, changeCustomerPasswordSchema);
    if (!body.success) return body.response;

    const currentPasswordHash = await getCustomerPasswordHash(customer);
    if (!currentPasswordHash) {
      return Response.json(
        { error: "Customer account is no longer available" },
        { status: 409 },
      );
    }

    if (!(await bcrypt.compare(body.data.currentPassword, currentPasswordHash))) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    const nextPasswordHash = await bcrypt.hash(body.data.newPassword, 12);
    const updated = await updateCustomerPassword(
      customer,
      currentPasswordHash,
      nextPasswordHash,
    );
    if (!updated) {
      return Response.json(
        { error: "Account changed during the request. Please try again." },
        { status: 409 },
      );
    }

    await revokeUserSecuritySessions(customer.id);

    return Response.json(
      { message: "Password updated", sessionsRevoked: true },
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
      "Failed to update customer password",
      "Password could not be updated",
    );
  }
}
