import "server-only";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { findUserForSession } from "@/lib/data-access/users";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationDeniedError extends Error {
  constructor() {
    super("You do not have permission to access this resource");
    this.name = "AuthorizationDeniedError";
  }
}

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  return session?.user?.id
    ? findUserForSession(session.user.id)
    : null;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export async function requireSuperAdminPageUser(
  callbackUrl = "/super-admin/dashboard",
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (user.role !== "super_admin") redirect("/");
  return user;
}

export async function requireMerchantPageUser(
  callbackUrl = "/merchant/dashboard",
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  const membership = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.merchantStaff.findFirst({
      where: { userId: user.id, status: "active" },
      select: {
        merchantId: true,
        merchant: {
          select: { id: true, name: true, email: true, role: true, isSuspended: true, isAnonymized: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  );
  if (!membership && user.role === "seller") return user;
  if (
    !membership ||
    membership.merchant.role !== "seller" ||
    membership.merchant.isSuspended ||
    membership.merchant.isAnonymized
  ) {
    redirect("/");
  }
  return {
    ...membership.merchant,
    role: "seller" as const,
  };
}

export async function getMerchantWorkspacePermissions(userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isSuspended: true, isAnonymized: true },
  });
  const membership = await prisma.merchantStaff.findFirst({
    where: { userId, status: "active" },
    select: {
      role: true,
      canManageProducts: true,
      canManageOrders: true,
      canManageStaff: true,
      canManageFinancialProfile: true,
    },
  });
  if (!membership) {
    if (user?.role === "seller" && !user.isSuspended && !user.isAnonymized) {
      return {
        isOwner: true,
        role: "owner" as const,
        canManageProducts: true,
        canManageOrders: true,
        canManageStaff: true,
        canManageFinancialProfile: true,
      };
    }
    return null;
  }
  return {
    isOwner: false,
    role: membership.role,
    canManageProducts: membership.canManageProducts,
    canManageOrders: membership.canManageOrders,
    canManageStaff: membership.canManageStaff,
    canManageFinancialProfile: membership.canManageFinancialProfile,
  };
}

export async function requireMerchantWorkspacePermission(
  permission:
    | "canManageProducts"
    | "canManageOrders"
    | "canManageStaff"
    | "canManageFinancialProfile",
) {
  const user = await requireAuthenticatedUser();
  const permissions = await getMerchantWorkspacePermissions(user.id);
  if (!permissions || !permissions[permission]) {
    throw new AuthorizationDeniedError();
  }
  return user;
}

export async function requireMerchantWorkspaceUser(
  permission:
    | "canManageProducts"
    | "canManageOrders"
    | "canManageStaff"
    | "canManageFinancialProfile",
) {
  const user = await requireAuthenticatedUser();
  const { prisma } = await import("@/lib/prisma");

  const membership = await prisma.merchantStaff.findFirst({
    where: {
      userId: user.id,
      status: "active",
      merchant: {
        role: "seller",
        isSuspended: false,
        isAnonymized: false,
      },
    },
    select: {
      canManageProducts: true,
      canManageOrders: true,
      canManageStaff: true,
      canManageFinancialProfile: true,
      merchant: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
  if (!membership && user.role === "seller") {
    const owner = await prisma.user.findFirst({
      where: {
        id: user.id,
        role: "seller",
        isActive: true,
        archivedAt: null,
        isSuspended: false,
        isAnonymized: false,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    if (owner) return owner;
  }
  if (!membership || !membership[permission]) {
    throw new AuthorizationDeniedError();
  }
  return {
    ...membership.merchant,
    role: "seller" as const,
  };
}

export async function requireCustomerPageUser(callbackUrl = "/orders") {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (user.role !== "customer") redirect("/");
  return user;
}

export async function requireUserRole(role: UserRole | readonly UserRole[]) {
  const user = await requireAuthenticatedUser();
  const allowedRoles = typeof role === "string" ? [role] : role;
  if (!allowedRoles.includes(user.role)) throw new AuthorizationDeniedError();
  return user;
}

export function authorizationErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return Response.json({ error: "You do not have permission" }, { status: 403 });
  }
  return null;
}
