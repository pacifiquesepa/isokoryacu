import {
  OrderPaymentProofConflictError,
  OrderStatusConflictError,
  updateOrderStatusAsAdmin,
} from "@/lib/data-access/orders";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { dispatchOrderNotificationsSafely } from "@/lib/notifications/order-notification-delivery";
import { checkAdminOrderWriteLimit } from "@/lib/rate-limit";
import {
  orderIdSchema,
  updateOrderStatusSchema,
} from "@/lib/validation/orders";

type AdminOrderStatusRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: AdminOrderStatusRouteContext,
) {
  try {
    const admin = await requireUserRole(["admin", "super_admin"]);
    const { id } = await context.params;
    const parsedId = orderIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const limit = await checkAdminOrderWriteLimit(admin.id);
    if (!limit.allowed) return rateLimitResponse(limit, "order status update");

    const body = await parseJsonRequest(request, updateOrderStatusSchema);
    if (!body.success) return body.response;

    const order = await updateOrderStatusAsAdmin(
      parsedId.data,
      body.data.status,
      admin.id,
    );
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    const notificationDelivery = await dispatchOrderNotificationsSafely(
      order.id,
      body.data.status,
    );

    return Response.json({ ...order, notificationDelivery }, {
      headers: { "Cache-Control": "no-store" },
    });
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
      "Failed to update order status",
      "Order status could not be updated",
    );
  }
}
