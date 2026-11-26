import { z } from "zod";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { upsertMerchantStaffAssignment } from "@/lib/data-access/merchant-staff";

const staffSchema = z
  .object({
    userId: z.string().trim().min(1).max(100),
    role: z.enum(["owner", "manager", "operations", "support", "finance"]),
    canManageProducts: z.boolean(),
    canManageOrders: z.boolean(),
    canManageStaff: z.boolean(),
    canManageFinancialProfile: z.boolean(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const actor = await requireMerchantWorkspaceUser("canManageStaff");
    const body = await parseJsonRequest(request, staffSchema);
    if (!body.success) return body.response;
    const staff = await upsertMerchantStaffAssignment(actor.id, body.data);
    return Response.json(staff, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to save merchant staff",
      "Staff assignment could not be saved",
    );
  }
}
