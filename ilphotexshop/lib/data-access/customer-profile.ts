import "server-only";

import { Prisma, UserRole } from "@prisma/client";
import type { User } from "@prisma/client";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

type CustomerActor = Pick<User, "id" | "role">;

function assertCustomer(actor: CustomerActor) {
  if (actor.role !== UserRole.customer) {
    throw new AuthorizationDeniedError();
  }
}

export async function getCustomerProfile(actor: CustomerActor) {
  assertCustomer(actor);
  return prisma.user.findFirst({
    where: {
      id: actor.id,
      role: UserRole.customer,
      isActive: true,
      isSuspended: false,
      isAnonymized: false,
    },
    select: {
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });
}

export async function updateCustomerProfile(
  actor: CustomerActor,
  input: { name: string; phone: string | null },
) {
  assertCustomer(actor);
  const updated = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET "name" = ${input.name},
          "phone" = ${input.phone},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${actor.id}
        AND "role" = ${UserRole.customer}::"UserRole"
        AND "isActive" = true
        AND "isSuspended" = false
        AND "isAnonymized" = false
    `,
  );
  if (updated !== 1) return null;

  return getCustomerProfile(actor);
}

export async function getCustomerPasswordHash(actor: CustomerActor) {
  assertCustomer(actor);
  const rows = await prisma.$queryRaw<{ passwordHash: string }[]>(
    Prisma.sql`
      SELECT "passwordHash"
      FROM "User"
      WHERE "id" = ${actor.id}
        AND "role" = ${UserRole.customer}::"UserRole"
        AND "isActive" = true
        AND "isSuspended" = false
        AND "isAnonymized" = false
      LIMIT 1
    `,
  );
  return rows[0]?.passwordHash ?? null;
}

export async function updateCustomerPassword(
  actor: CustomerActor,
  currentPasswordHash: string,
  nextPasswordHash: string,
) {
  assertCustomer(actor);
  const updated = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET "passwordHash" = ${nextPasswordHash},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${actor.id}
        AND "role" = ${UserRole.customer}::"UserRole"
        AND "passwordHash" = ${currentPasswordHash}
        AND "isActive" = true
        AND "isSuspended" = false
        AND "isAnonymized" = false
    `,
  );
  return updated === 1;
}
