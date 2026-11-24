import "server-only";

import { UserRole } from "@prisma/client";
import type { User } from "@prisma/client";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { getLowStockThreshold } from "@/lib/commerce/pricing";
import { prisma } from "@/lib/prisma";

type MerchantActor = Pick<User, "id" | "role">;

export async function getMerchantInventory(actor: MerchantActor) {
  if (actor.role !== UserRole.seller) throw new AuthorizationDeniedError();
  const products = await prisma.product.findMany({
    where: { ownerId: actor.id },
    select: {
      id: true,
      name: true,
      image: true,
      categoryInfo: { select: { name: true, lowStockThreshold: true } },
      stockQuantity: true,
      lowStockThreshold: true,
      isPublished: true,
      updatedAt: true,
    },
    orderBy: [{ stockQuantity: "asc" }, { name: "asc" }],
  });
  return products.map(({ categoryInfo, ...product }) => {
    const threshold = getLowStockThreshold(
      product.lowStockThreshold,
      categoryInfo.lowStockThreshold,
    );
    return {
      ...product,
      category: categoryInfo.name,
      lowStockThreshold: threshold,
      isLowStock: product.stockQuantity <= threshold,
    };
  });
}

export async function getMerchantStockMovements(
  actor: MerchantActor,
  limit = 50,
) {
  if (actor.role !== UserRole.seller) throw new AuthorizationDeniedError();
  return prisma.productStockMovement.findMany({
    where: { product: { is: { ownerId: actor.id } } },
    select: {
      id: true,
      productName: true,
      type: true,
      quantityChange: true,
      quantityBefore: true,
      quantityAfter: true,
      reason: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(limit, 100)),
  });
}
