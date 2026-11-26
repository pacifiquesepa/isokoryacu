import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageStaff");
    const { id } = await context.params;
    const parsedId = z.string().trim().min(1).max(100).safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid invitation ID" }, { status: 400 });
    }
    const result = await prisma.staffInvitation.updateMany({
      where: { id: parsedId.data, merchantId: merchant.id, status: "pending" },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (result.count !== 1) {
      return Response.json({ error: "Invitation not found" }, { status: 404 });
    }
    return Response.json({ cancelled: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to cancel staff invitation", "Staff invitation could not be cancelled");
  }
}
