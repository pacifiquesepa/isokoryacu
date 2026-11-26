import "server-only";

import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import {
  findUserForCredentials,
  getUserPasswordHash,
  recordSuccessfulUserLogin,
} from "@/lib/data-access/users";
import {
  createSecuritySession,
  isSecuritySessionValid,
  recordLoginEvent,
  revokeSecuritySessionByToken,
  SecurityDeviceBlockedError,
} from "@/lib/data-access/security-auth";
import { decryptTotpSecret, verifyTotp } from "@/lib/security-totp";
import { hashEmailOtp } from "@/lib/security-email-otp";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { credentialsSchema } from "@/lib/validation/auth";

const dummyPasswordHash =
  "$2b$12$aRp6hwqKPdu/PYJaZqz4w.2Unu.i4948bu.crXOZLbw8j/slykO/G";

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPasswordAuthVersion(passwordHash: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Authentication secret is not configured");
  return createHmac("sha256", secret)
    .update(passwordHash)
    .digest("hex");
}

function getTrustedAuthIp(headers: Record<string, string | string[] | undefined>) {
  if (process.env.AUTH_TRUST_PROXY_HEADERS !== "true") return "unknown";
  return (
    firstHeaderValue(headers["x-real-ip"]) ??
    firstHeaderValue(headers["x-forwarded-for"])?.split(",")[0] ??
    "unknown"
  ).trim().slice(0, 64) || "unknown";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Authenticator code", type: "text" },
        emailOtpCode: { label: "Email verification code", type: "text" },
      },
      async authorize(credentials, request) {
        const headers = request.headers ?? {};
        const parsed = credentialsSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
          totpCode: credentials?.totpCode,
          emailOtpCode: credentials?.emailOtpCode,
        });
        if (!parsed.success) return null;

        const ipAddress = getTrustedAuthIp(headers);
        const userAgent = firstHeaderValue(headers["user-agent"]);
        const rateLimit = await checkLoginRateLimit(
          ipAddress,
          parsed.data.email,
        );
        if (!rateLimit.allowed && rateLimit.reason === "unconfigured") {
          await recordLoginEvent({
            email: parsed.data.email,
            outcome: "blocked",
            reason: "rate_limit_unconfigured",
            ipAddress,
            userAgent,
          });
          throw new Error("Authentication rate limiting is not configured");
        }
        if (!rateLimit.allowed) {
          await recordLoginEvent({
            email: parsed.data.email,
            outcome: "blocked",
            reason: "rate_limit",
            ipAddress,
            userAgent,
          });
          return null;
        }

        const user = await findUserForCredentials(parsed.data.email);
        const passwordMatches = await bcrypt.compare(
          parsed.data.password,
          user?.passwordHash ?? dummyPasswordHash,
        );

        if (
          !user ||
          !passwordMatches ||
          !user.isActive ||
          user.archivedAt ||
          user.isSuspended ||
          user.isAnonymized
        ) {
          await recordLoginEvent({
            email: parsed.data.email,
            userId: user?.id,
            outcome: "failed",
            reason: "invalid_credentials_or_inactive_account",
            ipAddress,
            userAgent,
          });
          return null;
        }

        if (user.twoFactorEnabled) {
          const validCode =
            user.twoFactorSecret &&
            parsed.data.totpCode &&
            verifyTotp(
              decryptTotpSecret(user.twoFactorSecret),
              parsed.data.totpCode,
            );
          if (!validCode) {
            await recordLoginEvent({
              email: parsed.data.email,
              userId: user.id,
              outcome: "failed",
              reason: "invalid_or_missing_totp",
              ipAddress,
              userAgent,
            });
            return null;
          }
        }

        if (user.emailTwoFactorEnabled) {
          const validEmailCode =
            user.emailTwoFactorPendingCodeHash &&
            user.emailTwoFactorPendingExpiresAt &&
            user.emailTwoFactorPendingExpiresAt.getTime() > Date.now() &&
            parsed.data.emailOtpCode &&
            hashEmailOtp(parsed.data.emailOtpCode) ===
              user.emailTwoFactorPendingCodeHash;
          if (!validEmailCode) {
            await recordLoginEvent({
              email: parsed.data.email,
              userId: user.id,
              outcome: "failed",
              reason: "invalid_or_missing_email_otp",
              ipAddress,
              userAgent,
            });
            return null;
          }
        }

        let securitySessionToken: string;
        try {
          securitySessionToken = await createSecuritySession({
            userId: user.id,
            ipAddress,
            userAgent,
          });
        } catch (error) {
          if (!(error instanceof SecurityDeviceBlockedError)) throw error;
          await recordLoginEvent({
            email: parsed.data.email,
            userId: user.id,
            outcome: "blocked",
            reason: "blocked_device",
            ipAddress,
            userAgent,
          });
          return null;
        }

        try {
          if (user.emailTwoFactorEnabled) {
            await prisma.user.updateMany({
              where: {
                id: user.id,
                emailTwoFactorPendingCodeHash: user.emailTwoFactorPendingCodeHash,
              },
              data: {
                emailTwoFactorPendingCodeHash: null,
                emailTwoFactorPendingExpiresAt: null,
              },
            });
          }
          await recordSuccessfulUserLogin(user.id);
          await recordLoginEvent({
            email: parsed.data.email,
            userId: user.id,
            outcome: "success",
            ipAddress,
            userAgent,
          });
        } catch (error) {
          await revokeSecuritySessionByToken(securitySessionToken);
          throw error;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authVersion: getPasswordAuthVersion(user.passwordHash),
          securitySessionToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.authVersion = user.authVersion;
        token.securitySessionToken = user.securitySessionToken;
      } else if (token.sub) {
        const passwordHash = await getUserPasswordHash(token.sub);
        const currentAuthVersion = passwordHash
          ? getPasswordAuthVersion(passwordHash)
          : null;
        const validSession =
          typeof token.securitySessionToken === "string" &&
          await isSecuritySessionValid(token.securitySessionToken, token.sub);
        if (
          typeof token.authVersion !== "string" ||
          currentAuthVersion !== token.authVersion ||
          !validSession
        ) {
          const revokedToken =
            currentAuthVersion !== token.authVersion &&
            typeof token.securitySessionToken === "string"
              ? token.securitySessionToken
              : null;
          delete token.sub;
          delete token.role;
          delete token.authVersion;
          delete token.securitySessionToken;
          if (revokedToken) await revokeSecuritySessionByToken(revokedToken);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.role) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (typeof token?.securitySessionToken === "string") {
        await revokeSecuritySessionByToken(token.securitySessionToken);
      }
    },
  },
};
