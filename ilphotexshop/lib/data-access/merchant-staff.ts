import "server-only";

import {
  Prisma,
  MerchantStaffRole,
  MerchantStaffStatus,
  MerchantStaffAuditAction,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthorizationDeniedError, requireMerchantPageUser } from "@/lib/authorization";

export async function getMerchantStaffData(status?: "active" | "inactive") {
  const merchant = await requireMerchantPageUser("/merchant/staff");
  const where: Prisma.MerchantStaffWhereInput = {
    merchantId: merchant.id,
    ...(status ? { status: status === "active" ? MerchantStaffStatus.active : MerchantStaffStatus.inactive } : {}),
  };
  const [rows, total, active, inactive, availableUsers] = await prisma.$transaction([
    prisma.merchantStaff.findMany({
      where,
      select: {
        id: true,
        role: true,
        status: true,
        canManageProducts: true,
        canManageOrders: true,
        canManageStaff: true,
        canManageFinancialProfile: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    }),
    prisma.merchantStaff.count({ where: { merchantId: merchant.id } }),
    prisma.merchantStaff.count({
      where: { merchantId: merchant.id, status: MerchantStaffStatus.active },
    }),
    prisma.merchantStaff.count({
      where: { merchantId: merchant.id, status: MerchantStaffStatus.inactive },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        isAnonymized: false,
        role: { not: "super_admin" },
        merchantStaffMemberships: {
          none: { merchantId: merchant.id },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { merchant, rows, total, active, inactive, availableUsers };
}

export async function upsertMerchantStaffAssignment(
  actorId: string,
  input: {
  userId: string;
  role: MerchantStaffRole;
  canManageProducts: boolean;
  canManageOrders: boolean;
  canManageStaff: boolean;
  canManageFinancialProfile: boolean;
  },
) {
  const merchant = await requireMerchantPageUser("/merchant/staff");
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { isActive: true, archivedAt: true, isAnonymized: true, role: true },
  });
  if (
    !user ||
    user.role === "super_admin" ||
    !user.isActive ||
    user.archivedAt ||
    user.isAnonymized
  ) {
    throw new Error("Choose an active, identifiable account.");
  }
  if (input.userId === merchant.id) {
    throw new Error("The merchant owner does not need a staff assignment.");
  }
  if (input.role === "owner" && !input.canManageStaff) {
    throw new Error("An owner role must retain staff management permission.");
  }
  const existing = await prisma.merchantStaff.findUnique({
    where: {
      merchantId_userId: { merchantId: merchant.id, userId: input.userId },
    },
    select: {
      id: true,
      role: true,
      canManageProducts: true,
      canManageOrders: true,
      canManageStaff: true,
      canManageFinancialProfile: true,
    },
  });
  return prisma.$transaction(async (transaction) => {
    const staff = await transaction.merchantStaff.upsert({
      where: {
        merchantId_userId: { merchantId: merchant.id, userId: input.userId },
      },
      create: {
        merchantId: merchant.id,
        userId: input.userId,
        role: input.role,
        status: MerchantStaffStatus.active,
        canManageProducts: input.canManageProducts,
        canManageOrders: input.canManageOrders,
        canManageStaff: input.canManageStaff,
        canManageFinancialProfile: input.canManageFinancialProfile,
      },
      update: {
        role: input.role,
        status: MerchantStaffStatus.active,
        canManageProducts: input.canManageProducts,
        canManageOrders: input.canManageOrders,
        canManageStaff: input.canManageStaff,
        canManageFinancialProfile: input.canManageFinancialProfile,
      },
    });
    await transaction.merchantStaffAudit.create({
      data: {
        merchantId: merchant.id,
        actorId,
        targetId: input.userId,
        action: existing
          ? MerchantStaffAuditAction.permissions_updated
          : MerchantStaffAuditAction.assigned,
        detail: existing
          ? `oldRole=${existing.role}; newRole=${input.role}; oldPermissions=[products=${existing.canManageProducts},orders=${existing.canManageOrders},staff=${existing.canManageStaff},finance=${existing.canManageFinancialProfile}]; newPermissions=[products=${input.canManageProducts},orders=${input.canManageOrders},staff=${input.canManageStaff},finance=${input.canManageFinancialProfile}]`
          : `oldRole=none; newRole=${input.role}; oldPermissions=[]; newPermissions=[products=${input.canManageProducts},orders=${input.canManageOrders},staff=${input.canManageStaff},finance=${input.canManageFinancialProfile}]`,
        success: true,
      },
    });
    return staff;
  });
}

export async function setMerchantStaffAssignmentStatus(
  actorId: string,
  staffId: string,
  status: "active" | "inactive",
) {
  const merchant = await requireMerchantPageUser("/merchant/staff");
  return prisma.$transaction(async (transaction) => {
    const staff = await transaction.merchantStaff.findFirst({
      where: { id: staffId, merchantId: merchant.id },
      select: { id: true, userId: true, status: true },
    });
    if (!staff) throw new AuthorizationDeniedError();
    const result = await transaction.merchantStaff.updateMany({
      where: { id: staffId, merchantId: merchant.id },
      data: {
        status:
          status === "active"
            ? MerchantStaffStatus.active
            : MerchantStaffStatus.inactive,
      },
    });
    if (result.count !== 1) throw new AuthorizationDeniedError();
    await transaction.merchantStaffAudit.create({
      data: {
        merchantId: merchant.id,
        actorId,
        targetId: staff.userId,
        action:
          status === "active"
            ? MerchantStaffAuditAction.activated
            : MerchantStaffAuditAction.suspended,
        detail: `oldStatus=${staff.status}; newStatus=${status}`,
        success: true,
      },
    });
    return true;
  });
}
