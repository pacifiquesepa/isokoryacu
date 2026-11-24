import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type UserRole } from "@prisma/client";
import {
  AuthorizationDeniedError,
  requireSuperAdminPageUser,
} from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import type {
  merchantKycReviewSchema,
  merchantKycSubmissionSchema,
  MerchantKycStatus,
} from "@/lib/validation/merchant-kyc";
import type { z } from "zod";

type KycSubmission = z.infer<typeof merchantKycSubmissionSchema>;
type KycReview = z.infer<typeof merchantKycReviewSchema>;

export type KycDocumentInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

export type MerchantKycListRow = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  businessName: string;
  status: MerchantKycStatus | "rejected";
  reason: string | null;
  createdAt: Date;
  isAuditRecord: boolean;
};

export type MerchantKycDetail = {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  businessName: string;
  businessAddress: string;
  taxId: string | null;
  status: MerchantKycStatus;
  reviewReason: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  registrationDocumentName: string;
  registrationDocumentMimeType: string;
  identityDocumentName: string;
  identityDocumentMimeType: string;
};

export type MerchantKycAuditDetail = {
  id: string;
  applicationId: string;
  actorName: string;
  actorEmail: string;
  action:
    | "approved"
    | "rejected"
    | "erased"
    | "reverification_requested";
  reason: string | null;
  createdAt: Date;
};

export type MerchantKycAuditLogRow = MerchantKycAuditDetail;

export class MerchantKycAlreadyExistsError extends Error {
  constructor() {
    super("A merchant application already exists for this account");
    this.name = "MerchantKycAlreadyExistsError";
  }
}

export class MerchantKycReviewConflictError extends Error {
  constructor() {
    super("This application is no longer pending review");
    this.name = "MerchantKycReviewConflictError";
  }
}

export class MerchantKycApplicantUnavailableError extends Error {
  constructor() {
    super("This applicant cannot be approved while the account is unavailable");
    this.name = "MerchantKycApplicantUnavailableError";
  }
}

export async function submitMerchantKyc(
  userId: string,
  input: KycSubmission,
  registrationDocument: KycDocumentInput,
  identityDocument: KycDocumentInput,
) {
  return prisma.$transaction(async (transaction) => {
    const userRows = await transaction.$queryRaw<
      { role: UserRole; isSuspended: boolean; isAnonymized: boolean }[]
    >(
      Prisma.sql`
        SELECT "role", "isSuspended", "isAnonymized"
        FROM "User"
        WHERE "id" = ${userId}
        FOR UPDATE
      `,
    );
    const user = userRows[0];
    if (
      !user ||
      (user.role !== "customer" && user.role !== "seller") ||
      user.isSuspended ||
      user.isAnonymized
    ) {
      throw new AuthorizationDeniedError();
    }

    const existing = await transaction.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT "id" FROM "MerchantKyc" WHERE "userId" = ${userId}`,
    );
    if (existing.length) throw new MerchantKycAlreadyExistsError();

    const id = randomUUID();
    await transaction.$executeRaw(
      Prisma.sql`
        INSERT INTO "MerchantKyc" (
          "id", "userId", "ownerFullName", "businessName", "businessAddress", "taxId",
          "registrationDocument", "registrationDocumentName",
          "registrationDocumentMimeType", "identityDocument",
          "identityDocumentName", "identityDocumentMimeType", "status"
        )
        VALUES (
          ${id}, ${userId}, ${input.ownerFullName}, ${input.businessName}, ${input.businessAddress},
          ${input.taxId || null}, ${registrationDocument.bytes},
          ${registrationDocument.fileName}, ${registrationDocument.mimeType},
          ${identityDocument.bytes}, ${identityDocument.fileName},
          ${identityDocument.mimeType}, 'pending'::"MerchantKycStatus"
        )
      `,
    );
    return { id, status: "pending" as const };
  });
}

export async function getOwnMerchantKycApplication(userId: string) {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      businessName: string;
      businessAddress: string;
      taxId: string | null;
      status: MerchantKycStatus;
      reviewReason: string | null;
      submittedAt: Date;
      reviewedAt: Date | null;
    }[]
  >(
    Prisma.sql`
      SELECT
        "id", "businessName", "businessAddress", "taxId", "status",
        "reviewReason", "submittedAt", "reviewedAt"
      FROM "MerchantKyc"
      WHERE "userId" = ${userId}
      LIMIT 1
    `,
  );
  return { application: rows[0] ?? null };
}

export const MERCHANT_KYC_PAGE_SIZE = 20;

export async function getSuperAdminMerchantKycList(
  status: MerchantKycStatus | "rejected",
  search: string,
  requestedPage: number,
) {
  const route = {
    pending: "pending-applications",
    approved: "approved-merchants",
    rejected: "rejected-applications",
  }[status];
  await requireSuperAdminPageUser(`/super-admin/merchants/${route}`);
  const page = Math.max(1, Math.min(1000, requestedPage));
  const offset = (page - 1) * MERCHANT_KYC_PAGE_SIZE;
  const searchPattern = `%${search}%`;

  const summaryQuery = prisma.$queryRaw<
    { pending: number; approved: number; rejected: number }[]
  >(
    Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM "MerchantKyc"
          WHERE "status" = 'pending'::"MerchantKycStatus") AS pending,
        (SELECT COUNT(*)::int FROM "MerchantKyc"
          WHERE "status" = 'approved'::"MerchantKycStatus") AS approved,
        (SELECT COUNT(*)::int FROM "MerchantKycAudit"
          WHERE "action" = 'rejected'::"MerchantKycAuditAction") AS rejected
    `,
  );

  if (status === "rejected") {
    const searchFilter = search
      ? Prisma.sql`AND COALESCE(audit."reason", '') ILIKE ${searchPattern}`
      : Prisma.empty;
    const [count, rows, summaryRows] = await prisma.$transaction([
      prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "MerchantKycAudit" audit
          WHERE "action" = 'rejected'::"MerchantKycAuditAction"
          ${searchFilter}
        `,
      ),
      prisma.$queryRaw<MerchantKycListRow[]>(
        Prisma.sql`
          SELECT
            audit."id",
            'Applicant data removed'::text AS "applicantName",
            ''::text AS "applicantEmail",
            '' AS "businessName",
            'rejected'::text AS "status",
            audit."reason",
            audit."createdAt",
            true AS "isAuditRecord"
          FROM "MerchantKycAudit" audit
          WHERE audit."action" = 'rejected'::"MerchantKycAuditAction"
            ${searchFilter}
          ORDER BY audit."createdAt" DESC
          LIMIT ${MERCHANT_KYC_PAGE_SIZE}
          OFFSET ${offset}
        `,
      ),
      summaryQuery,
    ]);
    return {
      total: count[0]?.count ?? 0,
      rows,
      summary: summaryRows[0] ?? { pending: 0, approved: 0, rejected: 0 },
      page,
      pageSize: MERCHANT_KYC_PAGE_SIZE,
    };
  }

  const searchFilter = search
    ? Prisma.sql`
        AND (
          application."ownerFullName" ILIKE ${searchPattern}
          OR applicant."email" ILIKE ${searchPattern}
          OR application."businessName" ILIKE ${searchPattern}
          OR COALESCE(application."reviewReason", '') ILIKE ${searchPattern}
        )
      `
    : Prisma.empty;
  const [count, rows, summaryRows] = await prisma.$transaction([
    prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "MerchantKyc" application
        INNER JOIN "User" applicant ON applicant."id" = application."userId"
        WHERE application."status" = ${status}::"MerchantKycStatus"
          ${searchFilter}
      `,
    ),
    prisma.$queryRaw<MerchantKycListRow[]>(
      Prisma.sql`
        SELECT
          application."id",
          application."ownerFullName" AS "applicantName",
          applicant."email" AS "applicantEmail",
          application."businessName",
          application."status"::text AS "status",
          application."reviewReason" AS "reason",
          application."submittedAt" AS "createdAt",
          false AS "isAuditRecord"
        FROM "MerchantKyc" application
        INNER JOIN "User" applicant ON applicant."id" = application."userId"
        WHERE application."status" = ${status}::"MerchantKycStatus"
          ${searchFilter}
        ORDER BY application."submittedAt" DESC
        LIMIT ${MERCHANT_KYC_PAGE_SIZE}
        OFFSET ${offset}
      `,
    ),
    summaryQuery,
  ]);
  return {
    total: count[0]?.count ?? 0,
    rows,
    summary: summaryRows[0] ?? { pending: 0, approved: 0, rejected: 0 },
    page,
    pageSize: MERCHANT_KYC_PAGE_SIZE,
  };
}

export async function getSuperAdminMerchantKycDetail(id: string) {
  await requireSuperAdminPageUser(`/super-admin/merchants/kyc/${id}`);
  const rows = await prisma.$queryRaw<MerchantKycDetail[]>(
    Prisma.sql`
      SELECT
        application."id",
        application."userId",
        application."ownerFullName" AS "applicantName",
        applicant."email" AS "applicantEmail",
        application."businessName",
        application."businessAddress",
        application."taxId",
        application."status",
        application."reviewReason",
        application."submittedAt",
        application."reviewedAt",
        application."registrationDocumentName",
        application."registrationDocumentMimeType",
        application."identityDocumentName",
        application."identityDocumentMimeType"
      FROM "MerchantKyc" application
      INNER JOIN "User" applicant ON applicant."id" = application."userId"
      WHERE application."id" = ${id}
      LIMIT 1
    `,
  );
  return rows[0] ?? null;
}

export async function getSuperAdminMerchantKycAuditDetail(id: string) {
  await requireSuperAdminPageUser(`/super-admin/merchants/kyc/audit/${id}`);
  const rows = await prisma.$queryRaw<MerchantKycAuditDetail[]>(
    Prisma.sql`
      SELECT
        audit."id",
        audit."applicationId",
        actor."name" AS "actorName",
        actor."email" AS "actorEmail",
        audit."action",
        audit."reason",
        audit."createdAt"
      FROM "MerchantKycAudit" audit
      INNER JOIN "User" actor ON actor."id" = audit."actorId"
      WHERE audit."id" = ${id}
      LIMIT 1
    `,
  );
  return rows[0] ?? null;
}

export async function getSuperAdminMerchantKycAuditLogs() {
  await requireSuperAdminPageUser("/super-admin/security/merchant-kyc");
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const [total, recent, rows] = await prisma.$transaction([
    prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`SELECT COUNT(*)::int AS count FROM "MerchantKycAudit"`,
    ),
    prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "MerchantKycAudit"
        WHERE "createdAt" >= ${start}
      `,
    ),
    prisma.$queryRaw<MerchantKycAuditLogRow[]>(
      Prisma.sql`
        SELECT
          audit."id",
          audit."applicationId",
          actor."name" AS "actorName",
          actor."email" AS "actorEmail",
          audit."action",
          audit."reason",
          audit."createdAt"
        FROM "MerchantKycAudit" audit
        INNER JOIN "User" actor ON actor."id" = audit."actorId"
        ORDER BY audit."createdAt" DESC
        LIMIT 100
      `,
    ),
  ]);
  return {
    total: total[0]?.count ?? 0,
    recent: recent[0]?.count ?? 0,
    rows,
  };
}

export async function getSuperAdminMerchantKycDocument(
  applicationId: string,
  document: "registration" | "identity",
) {
  await requireSuperAdminPageUser(
    `/super-admin/merchants/kyc/${applicationId}`,
  );
  if (document === "registration") {
    const rows = await prisma.$queryRaw<
      { bytes: Uint8Array; fileName: string; mimeType: string }[]
    >(
      Prisma.sql`
        SELECT
          "registrationDocument" AS "bytes",
          "registrationDocumentName" AS "fileName",
          "registrationDocumentMimeType" AS "mimeType"
        FROM "MerchantKyc"
        WHERE "id" = ${applicationId}
        LIMIT 1
      `,
    );
    return rows[0] ?? null;
  }
  const rows = await prisma.$queryRaw<
    { bytes: Uint8Array; fileName: string; mimeType: string }[]
  >(
    Prisma.sql`
      SELECT
        "identityDocument" AS "bytes",
        "identityDocumentName" AS "fileName",
        "identityDocumentMimeType" AS "mimeType"
      FROM "MerchantKyc"
      WHERE "id" = ${applicationId}
      LIMIT 1
    `,
  );
  return rows[0] ?? null;
}

export async function reviewMerchantKycAsSuperAdmin(
  actorId: string,
  applicationId: string,
  decision: KycReview,
) {
  return prisma.$transaction(async (transaction) => {
    const actorRows = await transaction.$queryRaw<{ role: UserRole }[]>(
      Prisma.sql`SELECT "role" FROM "User" WHERE "id" = ${actorId} FOR UPDATE`,
    );
    if (actorRows[0]?.role !== "super_admin") {
      throw new AuthorizationDeniedError();
    }

    const applicationRows = await transaction.$queryRaw<
      {
        userId: string;
        status: MerchantKycStatus;
        role: UserRole;
        isSuspended: boolean;
        isAnonymized: boolean;
      }[]
    >(
      Prisma.sql`
        SELECT
          application."userId",
          application."status",
          applicant."role",
          applicant."isSuspended",
          applicant."isAnonymized"
        FROM "MerchantKyc" application
        INNER JOIN "User" applicant ON applicant."id" = application."userId"
        WHERE application."id" = ${applicationId}
        FOR UPDATE OF application, applicant
      `,
    );
    const application = applicationRows[0];
    if (!application) return null;
    if (application.status !== "pending") {
      throw new MerchantKycReviewConflictError();
    }
    if (
      application.isSuspended ||
      application.isAnonymized ||
      (application.role !== "customer" && application.role !== "seller")
    ) {
      throw new MerchantKycApplicantUnavailableError();
    }

    if (decision.action === "reject") {
      await transaction.$executeRaw(
        Prisma.sql`
          INSERT INTO "MerchantKycAudit"
            ("id", "applicationId", "actorId", "action", "reason")
          VALUES (
            ${randomUUID()},
            ${applicationId},
            ${actorId},
            'rejected'::"MerchantKycAuditAction",
            ${decision.reason}
          )
        `,
      );
      await transaction.$executeRaw(
        Prisma.sql`
          DELETE FROM "MerchantKyc"
          WHERE "id" = ${applicationId} AND "status" = 'pending'::"MerchantKycStatus"
        `,
      );
      return { id: applicationId, status: "rejected" as const };
    }

    await transaction.$executeRaw(
      Prisma.sql`
        UPDATE "MerchantKyc"
        SET
          "status" = 'approved'::"MerchantKycStatus",
          "reviewReason" = ${decision.reason ?? null},
          "reviewedById" = ${actorId},
          "reviewedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${applicationId}
          AND "status" = 'pending'::"MerchantKycStatus"
      `,
    );
    if (application.role === "customer") {
      await transaction.$executeRaw(
        Prisma.sql`
          UPDATE "User"
          SET "role" = 'seller'::"UserRole", "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${application.userId}
            AND "role" = 'customer'::"UserRole"
            AND "isSuspended" = false
            AND "isAnonymized" = false
        `,
      );
      await transaction.$executeRaw(
        Prisma.sql`
          INSERT INTO "UserRoleAudit"
            ("id", "actorId", "targetId", "previousRole", "newRole")
          VALUES (
            ${randomUUID()},
            ${actorId},
            ${application.userId},
            'customer'::"UserRole",
            'seller'::"UserRole"
          )
        `,
      );
    }
    await transaction.$executeRaw(
      Prisma.sql`
        INSERT INTO "MerchantKycAudit"
          ("id", "applicationId", "actorId", "action", "reason")
        VALUES (
          ${randomUUID()},
          ${applicationId},
          ${actorId},
          'approved'::"MerchantKycAuditAction",
          ${decision.reason ?? null}
        )
      `,
    );
    return { id: applicationId, status: "approved" as const };
  });
}

export async function eraseMerchantKycAsSuperAdmin(
  actorId: string,
  merchantId: string,
  reason: string,
) {
  return prisma.$transaction(async (transaction) => {
    const actorRows = await transaction.$queryRaw<{ role: UserRole }[]>(
      Prisma.sql`SELECT "role" FROM "User" WHERE "id" = ${actorId} FOR UPDATE`,
    );
    if (actorRows[0]?.role !== "super_admin") {
      throw new AuthorizationDeniedError();
    }

    const userRows = await transaction.$queryRaw<
      { name: string; role: UserRole; isSuspended: boolean; isAnonymized: boolean }[]
    >(
      Prisma.sql`
        SELECT "name", "role", "isSuspended", "isAnonymized"
        FROM "User"
        WHERE "id" = ${merchantId}
        FOR UPDATE
      `,
    );
    const user = userRows[0];
    if (!user || user.role !== "seller" || !user.isSuspended) return null;
    if (user.isAnonymized) {
      return { id: merchantId, erased: false, alreadyAnonymized: true };
    }

    await transaction.$executeRaw(
      Prisma.sql`
        DELETE FROM "MerchantKyc"
        WHERE "userId" = ${merchantId}
      `,
    );
    await transaction.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "name" = ${`Closed merchant ${merchantId.slice(-8)}`},
          "email" = ${`closed+${merchantId}@deleted.invalid`},
          "phone" = NULL,
          "isAnonymized" = true,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${merchantId}
      `,
    );
    await transaction.$executeRaw(
      Prisma.sql`
        INSERT INTO "MerchantKycAudit"
          ("id", "applicationId", "actorId", "action", "reason")
        VALUES (
          ${randomUUID()},
          ${randomUUID()},
          ${actorId},
          'erased'::"MerchantKycAuditAction",
          ${reason}
        )
      `,
    );
    return { id: merchantId, erased: true, alreadyAnonymized: false };
  });
}
