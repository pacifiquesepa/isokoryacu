import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageProducts");
    const { id } = await context.params;
    const parsedId = z.string().trim().min(1).max(100).safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid notification ID" }, { status: 400 });
    }
    const updated = await prisma.merchantNotification.updateMany({
      where: { id: parsedId.data, merchantId: merchant.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) {
      return Response.json({ error: "Notification not found" }, { status: 404 });
    }
    return Response.json({ read: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "Failed to mark notification read", "Notification could not be updated");
  }
}
