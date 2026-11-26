import { z } from "zod";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { setMerchantStaffAssignmentStatus } from "@/lib/data-access/merchant-staff";

const statusSchema = z
  .object({ status: z.enum(["active", "inactive"]) })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireMerchantWorkspaceUser("canManageStaff");
    const { id } = await context.params;
    const parsedId = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .safeParse(id);
    if (!parsedId.success) {
      return Response.json({ error: "Invalid staff ID" }, { status: 400 });
    }
    const body = await parseJsonRequest(request, statusSchema);
    if (!body.success) return body.response;
    await setMerchantStaffAssignmentStatus(
      actor.id,
      parsedId.data,
      body.data.status,
    );
    return Response.json(
      { id: parsedId.data, status: body.data.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to update merchant staff",
      "Staff status could not be changed",
    );
  }
}
