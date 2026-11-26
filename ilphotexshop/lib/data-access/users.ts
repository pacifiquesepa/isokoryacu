import "server-only";

import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type UserAuthRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  archivedAt: Date | null;
  isSuspended: boolean;
  isAnonymized: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  emailTwoFactorEnabled: boolean;
  emailTwoFactorPendingCodeHash: string | null;
  emailTwoFactorPendingExpiresAt: Date | null;
};

export async function findUserForCredentials(email: string) {
  const rows = await prisma.$queryRaw<
    (UserAuthRecord & { passwordHash: string })[]
  >(
    Prisma.sql`
      SELECT "id", "email", "name", "passwordHash", "role", "isActive", "archivedAt", "isSuspended", "isAnonymized", "twoFactorEnabled", "twoFactorSecret", "emailTwoFactorEnabled", "emailTwoFactorPendingCodeHash", "emailTwoFactorPendingExpiresAt"
      FROM "User"
      WHERE "email" = ${email}
      LIMIT 1
    `,
  );
  return rows[0] ?? null;
}

export async function getUserPasswordHash(id: string) {
  const rows = await prisma.$queryRaw<{ passwordHash: string }[]>(
    Prisma.sql`
      SELECT "passwordHash"
      FROM "User"
      WHERE "id" = ${id}
        AND "isActive" = true
        AND "archivedAt" IS NULL
        AND "isSuspended" = false
        AND "isAnonymized" = false
      LIMIT 1
    `,
  );
  return rows[0]?.passwordHash ?? null;
}

export async function findUserForSession(id: string) {
  const rows = await prisma.$queryRaw<UserAuthRecord[]>(
    Prisma.sql`
      SELECT "id", "email", "name", "role", "isActive", "archivedAt", "isSuspended", "isAnonymized", "twoFactorEnabled", "twoFactorSecret"
      FROM "User"
      WHERE "id" = ${id}
      LIMIT 1
    `,
  );
  const user = rows[0];
  if (
    !user ||
    !user.isActive ||
    user.archivedAt ||
    user.isSuspended ||
    user.isAnonymized
  ) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createCustomerAccount(input: {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function recordSuccessfulUserLogin(id: string) {
  await prisma.user.updateMany({
    where: { id, isActive: true, archivedAt: null, isAnonymized: false },
    data: { lastLoginAt: new Date() },
  });
}
