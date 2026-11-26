import { z } from "zod";
import {
  requireMerchantWorkspaceUser,
  authorizationErrorResponse,
} from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { setMerchantProductArchivedState } from "@/lib/data-access/products";

const archiveSchema = z
  .object({ archived: z.boolean() })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireMerchantWorkspaceUser("canManageProducts");
    const { id } = await context.params;
    if (!id || id.length > 100) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 });
    }
    const body = await parseJsonRequest(request, archiveSchema);
    if (!body.success) return body.response;
    const changed = await setMerchantProductArchivedState(actor, id, body.data.archived);
    if (!changed) {
      return Response.json({ error: "Product not found or archive state unchanged" }, { status: 404 });
    }
    return Response.json(
      { archived: body.data.archived },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authorizationErrorResponse(error) ?? apiErrorResponse(
      error,
      "Failed to update archived product state",
      "Product archive state could not be changed",
    );
  }
}
