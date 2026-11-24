import { revalidatePath } from "next/cache";
import { requireUserRole } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { setProductScheduledState } from "@/lib/data-access/super-admin-product-management";
import { InvalidProductScheduleError } from "@/lib/data-access/products";
import { productIdSchema, productScheduleSchema } from "@/lib/validation/products";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUserRole("super_admin");
    const { id } = await context.params;
    const parsedId = productIdSchema.safeParse(id);
    if (!parsedId.success) return Response.json({ error: "Invalid product ID" }, { status: 400 });
    const body = await parseJsonRequest(request, productScheduleSchema);
    if (!body.success) return body.response;
    const scheduledAt = body.data.scheduledAt ? new Date(body.data.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return Response.json({ error: "Invalid schedule time" }, { status: 400 });
    }
    const result = await setProductScheduledState(actor.id, parsedId.data, scheduledAt);
    void result;
    revalidatePath("/super-admin/products/scheduled-products");
    revalidatePath("/");
    return Response.json({ id: parsedId.data, scheduledAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidProductScheduleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiErrorResponse(error, "Failed to schedule product", "Schedule could not be updated");
  }
}
