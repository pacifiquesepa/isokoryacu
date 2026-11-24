import { revalidatePath } from "next/cache";
import { requireUserRole } from "@/lib/authorization";
import {
  moderateProductAsSuperAdmin,
  SuspendedMerchantProductError,
} from "@/lib/data-access/products";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkProductMutationLimit } from "@/lib/rate-limit";
import { moderateProductSchema, productIdSchema } from "@/lib/validation/products";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUserRole("super_admin");
    const { id } = await context.params;
    const parsedId = productIdSchema.safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 });
    }
    const limit = await checkProductMutationLimit(actor.id);
    if (!limit.allowed) {
      return rateLimitResponse(limit, "product moderation");
    }
    const body = await parseJsonRequest(request, moderateProductSchema);
    if (!body.success) return body.response;
    const result = await moderateProductAsSuperAdmin(
      actor.id,
      parsedId.data,
      body.data.action,
      body.data.reason,
    );
    if (!result) return Response.json({ error: "Product not found" }, { status: 404 });
    revalidatePath("/super-admin/products/pending-approval");
    revalidatePath("/super-admin/products/scheduled-products");
    revalidatePath("/super-admin/products");
    revalidatePath("/");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SuspendedMerchantProductError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return apiErrorResponse(
      error,
      "Failed to moderate product",
      "Product moderation could not be completed",
    );
  }
}
