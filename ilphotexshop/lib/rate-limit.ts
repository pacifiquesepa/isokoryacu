import "server-only";

import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const isConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = isConfigured ? Redis.fromEnv() : null;

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

function createLimiter(limit: number, window: Window, prefix: string) {
  return redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        analytics: true,
        prefix,
      })
    : null;
}

const productLimiter = createLimiter(60, "1 m", "ilphotox:products");
const loginIpLimiter = createLimiter(15, "15 m", "ilphotox:login:ip");
const loginPairLimiter = createLimiter(5, "15 m", "ilphotox:login:pair");
const registrationLimiter = createLimiter(5, "1 h", "ilphotox:register");
const sellerProductReadLimiter = createLimiter(60, "1 m", "ilphotox:seller:read");
const productMutationLimiter = createLimiter(30, "1 m", "ilphotox:product:write");
const sellerProfileMutationLimiter = createLimiter(
  10,
  "10 m",
  "ilphotox:seller:profile",
);
const superAdminProfileMutationLimiter = createLimiter(
  10,
  "10 m",
  "ilphotox:super-admin:profile",
);
const superAdminPasswordMutationLimiter = createLimiter(
  5,
  "15 m",
  "ilphotox:super-admin:password",
);
const customerProfileMutationLimiter = createLimiter(
  10,
  "10 m",
  "ilphotox:customer:profile",
);
const customerPasswordMutationLimiter = createLimiter(
  5,
  "15 m",
  "ilphotox:customer:password",
);
const orderReadLimiter = createLimiter(60, "1 m", "ilphotox:orders:read");
const orderWriteLimiter = createLimiter(10, "1 h", "ilphotox:orders:write");
const adminOrderWriteLimiter = createLimiter(30, "1 m", "ilphotox:orders:admin");
const userRoleWriteLimiter = createLimiter(10, "1 m", "ilphotox:users:role");
const userStateWriteLimiter = createLimiter(
  10,
  "1 m",
  "ilphotox:users:state",
);
const staffInvitationWriteLimiter = createLimiter(
  10,
  "1 h",
  "ilphotox:users:invitations",
);
const staffInvitationAcceptLimiter = createLimiter(
  5,
  "1 h",
  "ilphotox:users:invitations:accept",
);
const merchantAccessWriteLimiter = createLimiter(
  10,
  "1 m",
  "ilphotox:merchants:access",
);
const merchantKycSubmitLimiter = createLimiter(5, "1 h", "ilphotox:merchant:kyc");
const merchantKycReviewLimiter = createLimiter(30, "1 m", "ilphotox:merchant:kyc:review");
const merchantShopMutationLimiter = createLimiter(
  10,
  "10 m",
  "ilphotox:merchant:shop",
);
const paymentAccountMutationLimiter = createLimiter(
  10,
  "1 m",
  "ilphotox:super-admin:payment-accounts",
);
const paymentProofSubmitLimiter = createLimiter(
  5,
  "1 h",
  "ilphotox:customer:payment-proof",
);
const paymentProofReviewLimiter = createLimiter(
  30,
  "1 m",
  "ilphotox:super-admin:payment-proof-review",
);
const superAdminAnnouncementMutationLimiter = createLimiter(
  10,
  "1 h",
  "ilphotox:super-admin:announcements",
);
const securityAccountMutationLimiter = createLimiter(
  10,
  "15 m",
  "ilphotox:security:account",
);
const supportTicketSubmitLimiter = createLimiter(
  5,
  "15 m",
  "ilphotox:support-ticket",
);

export type RateLimitResult =
  | { allowed: true; remaining: number; reset: number }
  | { allowed: false; remaining: number; reset: number; reason?: "unconfigured" };

export async function checkRedisHealth() {
  if (!redis) return { status: "not-configured" as const, latency: null };

  const startedAt = performance.now();
  try {
    await redis.ping();
    return {
      status: "connected" as const,
      latency: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    console.error("Redis health check failed", error);
    return { status: "unavailable" as const, latency: null };
  }
}

async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        remaining: 0,
        reset: Date.now() + 60_000,
        reason: "unconfigured",
      };
    }

    return { allowed: true, remaining: 60, reset: Date.now() + 60_000 };
  }

  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function checkProductListingLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return checkLimit(productLimiter, identifier);
}

export async function checkLoginRateLimit(
  ipAddress: string,
  email: string,
): Promise<RateLimitResult> {
  if (!loginIpLimiter || !loginPairLimiter) {
    return checkLimit(null, ipAddress);
  }

  const emailIpKey = createHash("sha256")
    .update(`${ipAddress}\0${email}`)
    .digest("hex");
  const pairResult = await loginPairLimiter.limit(emailIpKey);
  const ipResult = ipAddress === "unknown"
    ? null
    : await loginIpLimiter.limit(ipAddress);
  const allowed = pairResult.success && (ipResult?.success ?? true);

  return {
    allowed,
    remaining: Math.min(ipResult?.remaining ?? pairResult.remaining, pairResult.remaining),
    reset: Math.max(ipResult?.reset ?? pairResult.reset, pairResult.reset),
  };
}

export async function checkRegistrationRateLimit(
  ipAddress: string,
): Promise<RateLimitResult> {
  return checkLimit(registrationLimiter, ipAddress);
}

export async function checkSellerProductReadLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(sellerProductReadLimiter, userId);
}

export async function checkProductMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(productMutationLimiter, userId);
}

export async function checkSellerProfileMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(sellerProfileMutationLimiter, userId);
}

export async function checkSuperAdminProfileMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(superAdminProfileMutationLimiter, userId);
}

export async function checkSuperAdminPasswordMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(superAdminPasswordMutationLimiter, userId);
}

export async function checkCustomerProfileMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(customerProfileMutationLimiter, userId);
}

export async function checkCustomerPasswordMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(customerPasswordMutationLimiter, userId);
}

export async function checkOrderReadLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(orderReadLimiter, userId);
}

export async function checkOrderWriteLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(orderWriteLimiter, userId);
}

export async function checkAdminOrderWriteLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(adminOrderWriteLimiter, userId);
}

export async function checkUserRoleWriteLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(userRoleWriteLimiter, userId);
}

export async function checkUserStateWriteLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(userStateWriteLimiter, userId);
}

export async function checkStaffInvitationWriteLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(staffInvitationWriteLimiter, userId);
}

export async function checkStaffInvitationAcceptLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return checkLimit(staffInvitationAcceptLimiter, identifier);
}

export async function checkMerchantAccessWriteLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(merchantAccessWriteLimiter, userId);
}

export async function checkMerchantKycSubmitLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(merchantKycSubmitLimiter, userId);
}

export async function checkMerchantKycReviewLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(merchantKycReviewLimiter, userId);
}

export async function checkMerchantShopMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(merchantShopMutationLimiter, userId);
}

export async function checkPaymentAccountMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(paymentAccountMutationLimiter, userId);
}

export async function checkPaymentProofSubmitLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(paymentProofSubmitLimiter, userId);
}

export async function checkPaymentProofReviewLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(paymentProofReviewLimiter, userId);
}

export async function checkSuperAdminAnnouncementMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(superAdminAnnouncementMutationLimiter, userId);
}

export async function checkSecurityAccountMutationLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkLimit(securityAccountMutationLimiter, userId);
}

export async function checkSupportTicketSubmitLimit(
  identifier: string,
): Promise<RateLimitResult> {
  return checkLimit(supportTicketSubmitLimiter, identifier);
}

export function getClientIp(
  realIp?: string | null,
  forwardedFor?: string | null,
) {
  const ipAddress = realIp ?? forwardedFor?.split(",")[0] ?? "unknown";
  return ipAddress.trim().slice(0, 64) || "unknown";
}
