import {
  createCustomerOrder,
  IdempotencyKeyReuseError,
  OrderInventoryUnavailableError,
  OrderSubtotalTooLargeError,
  getCustomerOrders,
} from "@/lib/data-access/orders";
import { requireUserRole } from "@/lib/authorization";
import { dispatchOrderNotificationsSafely } from "@/lib/notifications/order-notification-delivery";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import {
  checkOrderReadLimit,
  checkOrderWriteLimit,
} from "@/lib/rate-limit";
import {
  createOrderSchema,
  idempotencyKeySchema,
  listOrdersQuerySchema,
} from "@/lib/validation/orders";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  try {
    const customer = await requireUserRole("customer");
    const query = listOrdersQuerySchema.safeParse(
      Object.fromEntries(requestUrl.searchParams.entries()),
    );
    if (!query.success) {
      return Response.json(
        { error: "Invalid order query", details: query.error.flatten() },
        { status: 400 },
      );
    }

    const limit = await checkOrderReadLimit(customer.id);
    if (!limit.allowed) return rateLimitResponse(limit, "order read");

    const result = await getCustomerOrders(customer.id, query.data);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to load customer orders",
      "Orders are temporarily unavailable",
    );
  }
}

export async function POST(request: Request) {
  try {
    const customer = await requireUserRole("customer");
    const limit = await checkOrderWriteLimit(customer.id);
    if (!limit.allowed) return rateLimitResponse(limit, "order write");

    const idempotencyKey = idempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!idempotencyKey.success) {
      return Response.json(
        { error: "A valid Idempotency-Key header is required" },
        { status: 400 },
      );
    }

    const body = await parseJsonRequest(request, createOrderSchema);
    if (!body.success) return body.response;

    const result = await createCustomerOrder(
      customer.id,
      idempotencyKey.data,
      body.data,
    );
    const notificationDelivery = await dispatchOrderNotificationsSafely(
      result.order.id,
      "placed",
    );
    return Response.json(
      { order: result.order, replayed: result.replayed, notificationDelivery },
      {
        status: result.replayed ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof OrderInventoryUnavailableError) {
      return Response.json({ error: "Product stock is unavailable" }, { status: 409 });
    }
    if (error instanceof OrderSubtotalTooLargeError) {
      return Response.json({ error: "Order subtotal is too large" }, { status: 400 });
    }
    if (error instanceof IdempotencyKeyReuseError) {
      return Response.json(
        { error: "Idempotency key was already used for a different order" },
        { status: 409 },
      );
    }
    return apiErrorResponse(
      error,
      "Failed to create customer order",
      "Order could not be created",
    );
  }
}
