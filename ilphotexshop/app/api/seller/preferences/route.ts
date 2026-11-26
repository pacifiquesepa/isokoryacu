import { z } from "zod";
import { requireMerchantWorkspaceUser } from "@/lib/authorization";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { prisma } from "@/lib/prisma";

const preferenceSchema = z
  .object({
    notificationEmail: z.boolean(),
    notificationInApp: z.boolean(),
    notificationWhatsapp: z.boolean(),
    appearance: z.enum(["light", "dark", "system"]),
    language: z.enum(["en", "fr", "rw"]),
  })
  .strict();

export async function GET() {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageProducts");
    const preference = await prisma.merchantPreference.findUnique({
      where: { merchantId: merchant.id },
    });
    return Response.json(
      preference ?? {
        notificationEmail: true,
        notificationInApp: true,
        notificationWhatsapp: false,
        appearance: "system",
        language: "en",
      },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to read merchant preferences", "Preferences could not be loaded");
  }
}

export async function PUT(request: Request) {
  try {
    const merchant = await requireMerchantWorkspaceUser("canManageProducts");
    const body = await parseJsonRequest(request, preferenceSchema);
    if (!body.success) return body.response;
    const preference = await prisma.merchantPreference.upsert({
      where: { merchantId: merchant.id },
      create: { merchantId: merchant.id, ...body.data },
      update: body.data,
    });
    return Response.json(preference, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update merchant preferences", "Preferences could not be saved");
  }
}
