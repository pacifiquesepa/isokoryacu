import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { hashEmailOtp } from "@/lib/security-email-otp";

const verifySchema = z
  .object({
    email: z.string().trim().email().max(254),
    otp: z.string().regex(/^[0-9]{6}$/),
  })
  .strict();

export async function POST(request: Request) {
  const body = await parseJsonRequest(request, verifySchema);
  if (!body.success) return body.response;
  const user = await prisma.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    select: {
      emailTwoFactorPendingCodeHash: true,
      emailTwoFactorPendingExpiresAt: true,
      isActive: true,
      archivedAt: true,
      isSuspended: true,
      isAnonymized: true,
    },
  });
  if (
    !user ||
    !user.isActive ||
    user.archivedAt ||
    user.isSuspended ||
    user.isAnonymized ||
    !user.emailTwoFactorPendingCodeHash ||
    !user.emailTwoFactorPendingExpiresAt ||
    user.emailTwoFactorPendingExpiresAt.getTime() <= Date.now() ||
    hashEmailOtp(body.data.otp) !== user.emailTwoFactorPendingCodeHash
  ) {
    return Response.json(
      { error: "The verification code is invalid or expired" },
      { status: 422 },
    );
  }
  return Response.json({ verified: true });
}
