import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageUser } from "@/lib/authorization";

export const SECURITY_PAGE_SIZE = 20;

export async function revokeSecuritySession(sessionId: string) {
  await requireSuperAdminPageUser("/super-admin/security/active-sessions");
  const result = await prisma.securitySession.updateMany({
    where: { id: sessionId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });
  return result.count === 1;
}

export async function revokeUserSecuritySessions(userId: string) {
  await prisma.securitySession.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}

export async function getAccountSecuritySessions(userId: string) {
  return prisma.securitySession.findMany({
    where: { userId },
    select: {
      id: true,
      ipAddress: true,
      deviceName: true,
      isRevoked: true,
      expiresAt: true,
      lastSeenAt: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    take: 50,
  });
}

export async function getAccountSecuritySession(userId: string, sessionId: string) {
  return prisma.securitySession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      ipAddress: true,
      deviceName: true,
      isRevoked: true,
      expiresAt: true,
      lastSeenAt: true,
      createdAt: true,
      revokedAt: true,
    },
  });
}

export async function revokeAccountSecuritySession(userId: string, sessionId: string) {
  const result = await prisma.securitySession.updateMany({
    where: {
      id: sessionId,
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    data: { isRevoked: true, revokedAt: new Date() },
  });
  return result.count === 1;
}

export async function getSecurityLoginHistory(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/login-history");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = search
    ? { OR: [
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { ipAddress: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { deviceName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ] }
    : {};
  const [rows, total, success, failed, blocked] = await prisma.$transaction([
    prisma.loginEvent.findMany({
      where,
      select: { id: true, email: true, outcome: true, reason: true, ipAddress: true, deviceName: true, createdAt: true, user: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SECURITY_PAGE_SIZE,
      skip: (safePage - 1) * SECURITY_PAGE_SIZE,
    }),
    prisma.loginEvent.count({ where }),
    prisma.loginEvent.count({ where: { outcome: "success" } }),
    prisma.loginEvent.count({ where: { outcome: "failed" } }),
    prisma.loginEvent.count({ where: { outcome: "blocked" } }),
  ]);
  return { rows, total, success, failed, blocked, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function getSecuritySessions(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/active-sessions");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = search
    ? { OR: [
        { ipAddress: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { deviceName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { user: { is: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
      ] }
    : {};
  const [rows, total, active] = await prisma.$transaction([
    prisma.securitySession.findMany({
      where,
      select: { id: true, ipAddress: true, deviceName: true, isRevoked: true, expiresAt: true, lastSeenAt: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: SECURITY_PAGE_SIZE,
      skip: (safePage - 1) * SECURITY_PAGE_SIZE,
    }),
    prisma.securitySession.count({ where }),
    prisma.securitySession.count({ where: { isRevoked: false, expiresAt: { gte: new Date() } } }),
  ]);
  return { rows, total, active, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function getSecurityTwoFactorUsers(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/two-factor-authentication");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};
  const [rows, total, enabled] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
      },
      orderBy: [{ twoFactorEnabled: "desc" }, { email: "asc" }],
      take: SECURITY_PAGE_SIZE,
      skip: (safePage - 1) * SECURITY_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { twoFactorEnabled: true } }),
  ]);
  return { rows, total, enabled, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function getSecurityReport() {
  await requireSuperAdminPageUser("/super-admin/security/security-reports");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [total, success, failed, blocked, openAlerts, activeSessions, twoFactorEnabled, totalUsers] =
    await prisma.$transaction([
      prisma.loginEvent.count({ where: { createdAt: { gte: since } } }),
      prisma.loginEvent.count({ where: { createdAt: { gte: since }, outcome: "success" } }),
      prisma.loginEvent.count({ where: { createdAt: { gte: since }, outcome: "failed" } }),
      prisma.loginEvent.count({ where: { createdAt: { gte: since }, outcome: "blocked" } }),
      prisma.securityAlert.count({ where: { status: { in: ["open", "investigating"] } } }),
      prisma.securitySession.count({ where: { isRevoked: false, expiresAt: { gt: new Date() } } }),
      prisma.user.count({ where: { twoFactorEnabled: true } }),
      prisma.user.count({ where: { isActive: true, archivedAt: null, isSuspended: false, isAnonymized: false } }),
    ]);
  return {
    since,
    total,
    success,
    failed,
    blocked,
    openAlerts,
    activeSessions,
    twoFactorEnabled,
    totalUsers,
  };
}

export async function getFailedLoginAttempts(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/failed-login-attempts");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = {
    outcome: { in: ["failed", "blocked"] as ("failed" | "blocked")[] },
    ...(search
      ? { OR: [
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { ipAddress: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ] }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.loginEvent.findMany({
      where,
      select: { id: true, email: true, outcome: true, reason: true, ipAddress: true, deviceName: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SECURITY_PAGE_SIZE,
      skip: (safePage - 1) * SECURITY_PAGE_SIZE,
    }),
    prisma.loginEvent.count({ where }),
  ]);
  return { rows, total, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function getIpMonitoring(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/ip-address-monitoring");
  const safePage = Math.max(1, Math.min(page, 500));
  const rows = await prisma.$queryRaw<
    { ipAddress: string; successCount: number; failedCount: number; lastSeenAt: Date }[]
  >(Prisma.sql`
    SELECT "ipAddress",
      COUNT(*) FILTER (WHERE "outcome" = 'success'::"LoginOutcome")::int AS "successCount",
      COUNT(*) FILTER (WHERE "outcome" IN ('failed'::"LoginOutcome", 'blocked'::"LoginOutcome"))::int AS "failedCount",
      MAX("createdAt") AS "lastSeenAt"
    FROM "LoginEvent"
    WHERE (${search ? search : ""} = '' OR "ipAddress" ILIKE ${`%${search}%`})
    GROUP BY "ipAddress"
    ORDER BY "lastSeenAt" DESC
    LIMIT ${SECURITY_PAGE_SIZE}
    OFFSET ${(safePage - 1) * SECURITY_PAGE_SIZE}
  `);
  const totalRows = await prisma.$queryRaw<{ count: number }[]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT "ipAddress")::int AS count
      FROM "LoginEvent"
      WHERE (${search ? search : ""} = '' OR "ipAddress" ILIKE ${`%${search}%`})
    `,
  );
  return { rows, total: totalRows[0]?.count ?? 0, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function getSecurityAlerts(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/security-alerts");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = search
    ? { OR: [
        { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { ipAddress: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ] }
    : {};
  const [rows, total, open] = await prisma.$transaction([
    prisma.securityAlert.findMany({
      where,
      select: { id: true, title: true, description: true, ipAddress: true, status: true, createdAt: true, resolvedAt: true, user: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SECURITY_PAGE_SIZE,
      skip: (safePage - 1) * SECURITY_PAGE_SIZE,
    }),
    prisma.securityAlert.count({ where }),
    prisma.securityAlert.count({ where: { status: "open" } }),
  ]);
  return { rows, total, open, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function updateSecurityAlert(actorId: string, id: string, status: "open" | "investigating" | "resolved" | "dismissed") {
  await requireSuperAdminPageUser("/super-admin/security/security-alerts");
  const result = await prisma.securityAlert.updateMany({
    where: { id },
    data: { status, resolvedById: status === "resolved" || status === "dismissed" ? actorId : null, resolvedAt: status === "resolved" || status === "dismissed" ? new Date() : null },
  });
  return result.count === 1;
}

export async function getSecurityDevices(search: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/security/device-management");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = search
    ? { OR: [
        { deviceName: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { lastIpAddress: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { user: { is: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
      ] }
    : {};
  const [rows, total, trusted, blocked] = await prisma.$transaction([
    prisma.securityDevice.findMany({
      where,
      select: { id: true, deviceName: true, lastIpAddress: true, trusted: true, blocked: true, lastSeenAt: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: SECURITY_PAGE_SIZE,
      skip: (safePage - 1) * SECURITY_PAGE_SIZE,
    }),
    prisma.securityDevice.count({ where }),
    prisma.securityDevice.count({ where: { trusted: true } }),
    prisma.securityDevice.count({ where: { blocked: true } }),
  ]);
  return { rows, total, trusted, blocked, page: safePage, pageSize: SECURITY_PAGE_SIZE };
}

export async function updateSecurityDevice(id: string, action: "trust" | "untrust" | "block" | "unblock") {
  await requireSuperAdminPageUser("/super-admin/security/device-management");
  const data =
    action === "trust" ? { trusted: true } :
    action === "untrust" ? { trusted: false } :
    action === "block" ? { blocked: true, trusted: false } :
    { blocked: false };
  const result = await prisma.securityDevice.updateMany({ where: { id }, data });
  return result.count === 1;
}

export async function getSecurityPolicies() {
  await requireSuperAdminPageUser("/super-admin/security/password-access-policies");
  const [rows] = await prisma.$transaction([prisma.securityPolicy.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] })]);
  return rows;
}

export async function upsertSecurityPolicy(actorId: string, input: { id?: string; type: "password" | "session" | "access"; name: string; value: string }) {
  await requireSuperAdminPageUser("/super-admin/security/password-access-policies");
  const id = input.id || `${input.type}:${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return prisma.securityPolicy.upsert({
    where: { id },
    create: { id, type: input.type, name: input.name, value: input.value, updatedById: actorId },
    update: { type: input.type, name: input.name, value: input.value, updatedById: actorId },
  });
}
