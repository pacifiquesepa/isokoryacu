import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { apiErrorResponse } from "@/lib/http/api-error-response";

const inviteSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    merchantRole: z.enum(["owner", "manager", "operations", "support", "finance"]),
    canManageProducts: z.boolean(),
    canManageOrders: z.boolean(),
    canManageStaff: z.boolean(),
    canManageFinancialProfile: z.boolean(),
  })
  .strict();

export async function GET() {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageStaff");
    const invitations = await prisma.staffInvitation.findMany({
      where: { merchantId: merchant.id, status: "pending" },
      select: { id: true, name: true, email: true, merchantRole: true, expiresAt: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return Response.json({ invitations });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load staff invitations", "Staff invitations could not be loaded");
  }
}

export async function POST(request: Request) {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageStaff");
    const body = await parseJsonRequest(request, inviteSchema);
    if (!body.success) return body.response;
    const email = body.data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return Response.json({ error: "A user account already exists for this email" }, { status: 409 });
    }
    if (await prisma.staffInvitation.findFirst({
      where: { merchantId: merchant.id, email, status: "pending" },
      select: { id: true },
    })) {
      return Response.json({ error: "A pending invitation already exists for this email" }, { status: 409 });
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await prisma.staffInvitation.create({
      data: {
        merchantId: merchant.id,
        name: body.data.name,
        email,
        role: "customer",
        merchantRole: body.data.merchantRole,
        canManageProducts: body.data.canManageProducts,
        canManageOrders: body.data.canManageOrders,
        canManageStaff: body.data.canManageStaff,
        canManageFinancialProfile: body.data.canManageFinancialProfile,
        status: "pending",
        tokenHash,
        invitedById: merchant.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return Response.json(
      { id: invitation.id, acceptUrl: `/staff-invite/${token}`, expiresAt: invitation.expiresAt },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to create merchant staff invitation", "Staff invitation could not be created");
  }
}
