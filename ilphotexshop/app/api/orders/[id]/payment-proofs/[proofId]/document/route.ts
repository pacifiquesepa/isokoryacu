import { requireUserRole } from "@/lib/authorization";
import { getCustomerPaymentProofDocument } from "@/lib/data-access/order-payment-proofs";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkOrderReadLimit } from "@/lib/rate-limit";
import { orderIdSchema } from "@/lib/validation/orders";
import { paymentProofIdSchema } from "@/lib/validation/payment-proofs";

type CustomerPaymentProofDocumentContext = {
  params: Promise<{ id: string; proofId: string }>;
};

export async function GET(
  _request: Request,
  context: CustomerPaymentProofDocumentContext,
) {
  try {
    const customer = await requireUserRole("customer");
    const { id, proofId } = await context.params;
    const parsedOrderId = orderIdSchema.safeParse(id);
    const parsedProofId = paymentProofIdSchema.safeParse(proofId);
    if (!parsedOrderId.success || !parsedProofId.success) {
      return Response.json({ error: "Invalid payment receipt reference" }, { status: 400 });
    }

    const limit = await checkOrderReadLimit(customer.id);
    if (!limit.allowed) return rateLimitResponse(limit, "payment receipt download");

    const document = await getCustomerPaymentProofDocument(
      customer.id,
      parsedOrderId.data,
      parsedProofId.data,
    );
    if (!document) {
      return Response.json({ error: "Payment receipt document not found" }, { status: 404 });
    }

    const fileName = document.documentName.replace(/[\r\n"\\]/g, "_");
    return new Response(new Uint8Array(document.document), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(document.document.byteLength),
        "Content-Type": document.documentMimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Failed to download customer payment receipt",
      "Payment receipt could not be downloaded",
    );
  }
}
