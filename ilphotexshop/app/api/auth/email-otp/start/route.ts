import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  createEmailOtp,
  sendEmailOtp,
} from "@/lib/security-email-otp";
import { checkLoginRateLimit } from "@/lib/rate-limit";

const startSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

export async function POST(request: Request) {
  const ipAddress =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const body = await parseJsonRequest(request, startSchema);
  if (!body.success) return body.response;
  const email = body.data.email.toLowerCase();
  const limit = await checkLoginRateLimit(ipAddress.slice(0, 64), email);
  if (!limit.allowed) {
    return Response.json({ sent: false, error: "Too many verification requests" }, { status: 429 });
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailTwoFactorEnabled: true,
      isActive: true,
      archivedAt: true,
      isSuspended: true,
      isAnonymized: true,
    },
  });
  if (
    !user ||
    !user.emailTwoFactorEnabled ||
    !user.isActive ||
    user.archivedAt ||
    user.isSuspended ||
    user.isAnonymized ||
    !(await bcrypt.compare(body.data.password, user.passwordHash))
  ) {
    return Response.json({ sent: false, error: "Email verification could not be started" }, { status: 400 });
  }
  const otp = createEmailOtp();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailTwoFactorPendingCodeHash: otp.hash,
      emailTwoFactorPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  await sendEmailOtp(user.email, otp.code);
  return Response.json({ sent: true }, { headers: { "Cache-Control": "no-store" } });
}
