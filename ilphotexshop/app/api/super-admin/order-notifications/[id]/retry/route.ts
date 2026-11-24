import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkAdminOrderWriteLimit } from "@/lib/rate-limit";
import { retryOrderNotification } from "@/lib/notifications/order-notification-delivery";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireUserRole("super_admin");
    const limit = await checkAdminOrderWriteLimit(admin.id);
    if (!limit.allowed) return rateLimitResponse(limit, "notification retry");
    const { id } = await context.params;
    if (!id || id.length > 100) {
      return Response.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    const delivery = await retryOrderNotification(id);
    if (!delivery) {
      return Response.json(
        { error: "Notification is not available for retry" },
        { status: 409 },
      );
    }
    return Response.json({ delivery }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to retry order notification",
      "Notification could not be retried",
    );
  }
}
