import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { apiErrorResponse } from "@/lib/http/api-error-response";

const ticketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(4000),
    category: z.string().trim().min(2).max(100),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageOrders");
    const body = await parseJsonRequest(request, ticketSchema);
    if (!body.success) return body.response;
    const ticket = await prisma.supportTicket.create({
      data: {
        requesterId: merchant.id,
        subject: body.data.subject,
        description: body.data.description,
        category: body.data.category,
        priority: "normal",
        status: "open",
      },
    });
    return Response.json({ id: ticket.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create support ticket", "Support ticket could not be created");
  }
}
