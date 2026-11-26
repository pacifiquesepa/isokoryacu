import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { createEmailOtp, sendEmailOtp } from "@/lib/security-email-otp";
import { checkLoginRateLimit, getClientIp } from "@/lib/rate-limit";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";

const requestSchema = z
  .object({ email: z.string().trim().email().max(254) })
  .strict();

export async function POST(request: Request) {
  const ipAddress = getClientIp(
    request.headers.get("x-real-ip") ?? undefined,
    request.headers.get("x-forwarded-for") ?? undefined,
  );
  const body = await parseJsonRequest(request, requestSchema);
  if (!body.success) return body.response;
  const email = body.data.email.toLowerCase();
  const limit = await checkLoginRateLimit(ipAddress, email);
  if (!limit.allowed) return rateLimitResponse(limit, "password reset");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true, archivedAt: true, isSuspended: true, isAnonymized: true },
  });
  if (user && user.isActive && !user.archivedAt && !user.isSuspended && !user.isAnonymized) {
    const otp = createEmailOtp();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailTwoFactorPendingCodeHash: otp.hash,
        emailTwoFactorPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await sendEmailOtp(user.email, otp.code);
  }
  return Response.json(
    { requested: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
