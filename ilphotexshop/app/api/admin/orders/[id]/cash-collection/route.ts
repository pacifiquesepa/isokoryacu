import { requireUserRole } from "@/lib/authorization";
import {
  CashCollectionConflictError,
  recordOrderCashCollection,
} from "@/lib/data-access/orders";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkAdminOrderWriteLimit } from "@/lib/rate-limit";
import { cashCollectionSchema, orderIdSchema } from "@/lib/validation/orders";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireUserRole(["admin", "super_admin"]);
    const { id } = await params;
    const parsedId = orderIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 });
    }
    const limit = await checkAdminOrderWriteLimit(admin.id);
    if (!limit.allowed) return rateLimitResponse(limit, "cash collection");
    const body = await parseJsonRequest(request, cashCollectionSchema);
    if (!body.success) return body.response;
    const result = await recordOrderCashCollection(
      parsedId.data,
      admin.id,
      body.data.reference,
    );
    if (!result) return Response.json({ error: "Order not found" }, { status: 404 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CashCollectionConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(error, "Failed to confirm cash collection", "Cash collection could not be recorded");
  }
}
