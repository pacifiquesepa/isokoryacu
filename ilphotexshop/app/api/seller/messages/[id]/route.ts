import { z } from "zod";
import { addMerchantConversationMessage } from "@/lib/data-access/merchant-portal";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { apiErrorResponse } from "@/lib/http/api-error-response";

const messageSchema = z
  .object({ body: z.string().trim().min(1).max(4000) })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await parseJsonRequest(request, messageSchema);
    if (!body.success) return body.response;
    const changed = await addMerchantConversationMessage(id, body.data.body);
    if (!changed) return Response.json({ error: "Conversation not found or closed" }, { status: 404 });
    return Response.json({ sent: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to send merchant message", "Message could not be sent");
  }
}
