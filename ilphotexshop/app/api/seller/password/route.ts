import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkCustomerPasswordMutationLimit } from "@/lib/rate-limit";
import { revokeUserSecuritySessions } from "@/lib/data-access/super-admin-security";
import { changeCustomerPasswordSchema } from "@/lib/validation/users";

export async function PATCH(request: Request) {
  try {
    const seller = await requireUserRole("seller");
    const limit = await checkCustomerPasswordMutationLimit(seller.id);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "merchant password");
    }

    const body = await parseJsonRequest(request, changeCustomerPasswordSchema);
    if (!body.success) return body.response;

    const account = await prisma.user.findFirst({
      where: {
        id: seller.id,
        role: "seller",
        isActive: true,
        isSuspended: false,
        isAnonymized: false,
      },
      select: { passwordHash: true },
    });
    if (!account) {
      return Response.json(
        { error: "Merchant account is no longer available" },
        { status: 409 },
      );
    }
    if (!(await bcrypt.compare(body.data.currentPassword, account.passwordHash))) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    const nextPasswordHash = await bcrypt.hash(body.data.newPassword, 12);
    const updated = await prisma.user.updateMany({
      where: {
        id: seller.id,
        role: "seller",
        passwordHash: account.passwordHash,
        isActive: true,
        isSuspended: false,
        isAnonymized: false,
      },
      data: {
        passwordHash: nextPasswordHash,
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      return Response.json(
        { error: "Account changed during the request. Please try again." },
        { status: 409 },
      );
    }

    await revokeUserSecuritySessions(seller.id);
    return Response.json(
      { message: "Password updated", sessionsRevoked: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to update merchant password",
      "Password could not be updated",
    );
  }
}
