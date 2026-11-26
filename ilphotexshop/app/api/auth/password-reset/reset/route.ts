import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { hashEmailOtp } from "@/lib/security-email-otp";
import { revokeUserSecuritySessions } from "@/lib/data-access/super-admin-security";
import { registrationPasswordSchema } from "@/lib/validation/auth";

const resetSchema = z
  .object({
    email: z.string().trim().email().max(254),
    otp: z.string().regex(/^[0-9]{6}$/),
    password: registrationPasswordSchema,
    confirmPassword: registrationPasswordSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: "custom", message: "Passwords do not match", path: ["confirmPassword"] });
    }
  });

export async function POST(request: Request) {
  const body = await parseJsonRequest(request, resetSchema);
  if (!body.success) return body.response;
  const user = await prisma.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    select: {
      id: true,
      passwordHash: true,
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
  const passwordHash = await bcrypt.hash(body.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailTwoFactorPendingCodeHash: null,
        emailTwoFactorPendingExpiresAt: null,
      },
    }),
  ]);
  await revokeUserSecuritySessions(user.id);
  return Response.json({ reset: true });
}
