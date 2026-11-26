import { prisma } from "@/lib/prisma";
import {
  authorizationErrorResponse,
  requireAuthenticatedUser,
} from "@/lib/authorization";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkSecurityAccountMutationLimit } from "@/lib/rate-limit";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  createTotpSecret,
  verifyTotp,
} from "@/lib/security-totp";
import { revokeUserSecuritySessions } from "@/lib/data-access/super-admin-security";
import { twoFactorActionSchema } from "@/lib/validation/security";
import bcrypt from "bcryptjs";
import {
  createEmailOtp,
  hashEmailOtp,
  sendEmailOtp,
} from "@/lib/security-email-otp";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        twoFactorEnabled: true,
        emailTwoFactorEnabled: true,
      },
    });
    return Response.json(
      {
        enabled:
          Boolean(account?.twoFactorEnabled) ||
          Boolean(account?.emailTwoFactorEnabled),
        authenticator: account?.twoFactorEnabled ?? false,
        email: account?.emailTwoFactorEnabled ?? false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authorizationErrorResponse(error) ?? apiErrorResponse(
      error,
      "Failed to read two-factor status",
      "Security status could not be loaded",
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const limit = await checkSecurityAccountMutationLimit(user.id);
    if (!limit.allowed) return rateLimitResponse(limit, "two-factor update");

    const body = await parseJsonRequest(request, twoFactorActionSchema);
    if (!body.success) return body.response;

    if (body.data.action === "setup") {
      const secret = createTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorPendingSecret: encryptTotpSecret(secret) },
      });
      const label = encodeURIComponent(`ILPhotoX Shop:${user.email}`);
      const issuer = encodeURIComponent("ILPhotoX Shop");
      return Response.json(
        {
          secret,
          otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorPendingSecret: true,
        emailTwoFactorEnabled: true,
        emailTwoFactorPendingCodeHash: true,
        emailTwoFactorPendingExpiresAt: true,
      },
    });
    if (!account) return Response.json({ error: "Account not found" }, { status: 404 });

    if (body.data.action === "configure") {
      if (!(await bcrypt.compare(body.data.password, account.passwordHash))) {
        return Response.json({ error: "Password is incorrect" }, { status: 422 });
      }
      if (body.data.authenticator && !account.twoFactorSecret) {
        return Response.json(
          { error: "Scan and verify the authenticator QR code first" },
          { status: 409 },
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailTwoFactorEnabled: body.data.email,
          ...(body.data.authenticator
            ? {}
            : { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null }),
          ...(!body.data.email
            ? { emailTwoFactorPendingCodeHash: null, emailTwoFactorPendingExpiresAt: null }
            : {}),
        },
      });
      await revokeUserSecuritySessions(user.id);
      return Response.json({
        enabled: body.data.authenticator || body.data.email,
        authenticator: body.data.authenticator,
        email: body.data.email,
        sessionsRevoked: true,
      });
    }

    if (body.data.action === "send_email_otp") {
      const otp = createEmailOtp();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailTwoFactorPendingCodeHash: otp.hash,
          emailTwoFactorPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      await sendEmailOtp(user.email, otp.code);
      return Response.json({ sent: true });
    }

    if (body.data.action === "verify_email_otp") {
      if (
        !account.emailTwoFactorPendingCodeHash ||
        !account.emailTwoFactorPendingExpiresAt ||
        account.emailTwoFactorPendingExpiresAt.getTime() <= Date.now() ||
        hashEmailOtp(body.data.code) !== account.emailTwoFactorPendingCodeHash
      ) {
        return Response.json({ error: "Email verification code is invalid or expired" }, { status: 422 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailTwoFactorEnabled: true,
          emailTwoFactorPendingCodeHash: null,
          emailTwoFactorPendingExpiresAt: null,
        },
      });
      return Response.json({ verified: true });
    }

    if (body.data.action === "enable") {
      if (!account.twoFactorPendingSecret) {
        return Response.json({ error: "Start two-factor setup first" }, { status: 409 });
      }
      const secret = decryptTotpSecret(account.twoFactorPendingSecret);
      if (!verifyTotp(secret, body.data.code)) {
        return Response.json({ error: "Authenticator code is invalid" }, { status: 422 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: account.twoFactorPendingSecret,
          twoFactorPendingSecret: null,
        },
      });
      return Response.json({ enabled: true });
    }

    if (
      !account.twoFactorEnabled ||
      !account.twoFactorSecret ||
      !(await bcrypt.compare(body.data.password, account.passwordHash)) ||
      !verifyTotp(decryptTotpSecret(account.twoFactorSecret), body.data.code)
    ) {
      return Response.json({ error: "Password or authenticator code is invalid" }, { status: 422 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
      },
    });
    await revokeUserSecuritySessions(user.id);
    return Response.json({ enabled: false, sessionsRevoked: true });
  } catch (error) {
    return authorizationErrorResponse(error) ?? apiErrorResponse(
      error,
      "Failed to update two-factor authentication",
      "Two-factor settings could not be updated",
    );
  }
}
