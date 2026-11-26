import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { z } from "zod";

const credentialCheckSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

export async function POST(request: Request) {
  const body = await parseJsonRequest(request, credentialCheckSchema);
  if (!body.success) return body.response;
  const user = await prisma.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    select: {
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      emailTwoFactorEnabled: true,
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
    !(await bcrypt.compare(body.data.password, user.passwordHash))
  ) {
    return Response.json(
      { error: "Email or password is incorrect" },
      { status: 401 },
    );
  }
  return Response.json(
    {
      authenticator: user.twoFactorEnabled && Boolean(user.twoFactorSecret),
      email: user.emailTwoFactorEnabled,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
