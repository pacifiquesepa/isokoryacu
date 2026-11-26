import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { z } from "zod";
import { registrationPasswordSchema } from "@/lib/validation/auth";
import { checkStaffInvitationAcceptLimit, getClientIp } from "@/lib/rate-limit";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";

const acceptSchema = z.object({
  token: z.string().trim().min(32).max(128),
  password: registrationPasswordSchema,
}).strict();

export async function POST(request: Request) {
  const ipAddress = getClientIp(
    request.headers.get("x-real-ip") ?? undefined,
    request.headers.get("x-forwarded-for") ?? undefined,
  );
  const limit = await checkStaffInvitationAcceptLimit(ipAddress);
  if (!limit.allowed) return rateLimitResponse(limit, "staff invitation acceptance");
  const body = await parseJsonRequest(request, acceptSchema);
  if (!body.success) return body.response;

  const tokenHash = createHash("sha256").update(body.data.token).digest("hex");
  const invitation = await prisma.staffInvitation.findUnique({
    where: { tokenHash },
  });
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    return Response.json({ error: "Invitation is invalid or expired" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  if (existing) {
    return Response.json({ error: "A user account already exists for this email" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.data.password, 12);
  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: {
        name: invitation.name,
        email: invitation.email,
        passwordHash,
        role: invitation.merchantId ? "customer" : "admin",
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    if (invitation.merchantId && invitation.merchantRole) {
      await transaction.merchantStaff.create({
        data: {
          merchantId: invitation.merchantId,
          userId: created.id,
          role: invitation.merchantRole,
          status: "active",
          canManageProducts: invitation.canManageProducts,
          canManageOrders: invitation.canManageOrders,
          canManageStaff: invitation.canManageStaff,
          canManageFinancialProfile: invitation.canManageFinancialProfile,
        },
      });
    }
    await transaction.staffInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "accepted",
        acceptedById: created.id,
        acceptedAt: new Date(),
      },
    });
    return created;
  });

  return Response.json(
    { id: user.id, email: user.email, role: user.role },
    { headers: { "Cache-Control": "no-store" } },
  );
}
