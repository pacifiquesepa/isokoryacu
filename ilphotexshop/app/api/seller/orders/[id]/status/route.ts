import { OrderStatus } from "@prisma/client";
import {
  OrderPaymentProofConflictError,
  OrderStatusConflictError,
  updateOrderStatusAsAdmin,
} from "@/lib/data-access/orders";
import { prisma } from "@/lib/prisma";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { orderIdSchema, updateOrderStatusSchema } from "@/lib/validation/orders";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const seller = await requireMerchantWorkspaceUser("canManageOrders");
    const { id } = await context.params;
    const parsedId = orderIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 });
    }
    const body = await parseJsonRequest(request, updateOrderStatusSchema);
    if (!body.success) return body.response;

    if (
      body.data.status !== OrderStatus.confirmed &&
      body.data.status !== OrderStatus.processing &&
      body.data.status !== OrderStatus.cancelled
    ) {
      return Response.json(
        { error: "Merchants can only confirm, process, or cancel orders" },
        { status: 403 },
      );
    }

    const belongsToSeller = await prisma.order.findFirst({
      where: {
        id: parsedId.data,
        items: { some: { sellerId: seller.id } },
      },
      select: { id: true },
    });
    if (!belongsToSeller) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = await updateOrderStatusAsAdmin(
      parsedId.data,
      body.data.status,
      seller.id,
    );
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    return Response.json(order, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OrderPaymentProofConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OrderStatusConflictError) {
      return Response.json(
        { error: "Order status transition is not allowed" },
        { status: 409 },
      );
    }
    return apiErrorResponse(
      error,
      "Failed to update merchant order status",
      "Order status could not be updated",
    );
  }
}
