import {
  cancelCustomerOrder,
  OrderPaymentProofConflictError,
  OrderStatusConflictError,
} from "@/lib/data-access/orders";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkOrderWriteLimit } from "@/lib/rate-limit";
import { orderIdSchema } from "@/lib/validation/orders";
import { dispatchOrderNotificationsSafely } from "@/lib/notifications/order-notification-delivery";

type CancelOrderRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: CancelOrderRouteContext,
) {
  try {
    const customer = await requireUserRole("customer");
    const { id } = await context.params;
    const parsedId = orderIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const limit = await checkOrderWriteLimit(customer.id);
    if (!limit.allowed) return rateLimitResponse(limit, "order write");

    const order = await cancelCustomerOrder(customer.id, parsedId.data);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    const notificationDelivery = await dispatchOrderNotificationsSafely(
      order.id,
      "cancelled",
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
        { error: "Only pending orders can be cancelled" },
        { status: 409 },
      );
    }
    return apiErrorResponse(
      error,
      "Failed to cancel customer order",
      "Order could not be cancelled",
    );
  }
}
