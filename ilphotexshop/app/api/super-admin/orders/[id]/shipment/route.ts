import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { createOrderShipment } from "@/lib/data-access/super-admin-orders";
import { orderShipmentSchema, orderIdSchema } from "@/lib/validation/orders";
import { dispatchOrderNotificationsSafely } from "@/lib/notifications/order-notification-delivery";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireUserRole("super_admin");
    const { id } = await context.params;
    const parsedId = orderIdSchema.safeParse(id);
    if (!parsedId.success) return Response.json({ error: "Invalid order ID" }, { status: 400 });
    const body = await parseJsonRequest(request, orderShipmentSchema);
    if (!body.success) return body.response;
    const shipment = await createOrderShipment(parsedId.data, body.data);
    if (!shipment) return Response.json({ error: "Order not found" }, { status: 404 });
    const notificationDelivery = await dispatchOrderNotificationsSafely(
      parsedId.data,
      body.data.status,
    );
    return Response.json({ ...shipment, notificationDelivery });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create shipment", "Shipment could not be created");
  }
}
