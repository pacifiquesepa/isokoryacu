import "server-only";

import { ProductStockMovementType, Prisma } from "@prisma/client";
import type { ProductStockMovementType as MovementType } from "@prisma/client";

type StockItem = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
};

type StockTransaction = Prisma.TransactionClient;

export class InsufficientProductStockError extends Error {
  constructor() {
    super("Product stock is unavailable or insufficient");
    this.name = "InsufficientProductStockError";
  }
}

async function lockProduct(
  transaction: StockTransaction,
  productId: string,
) {
  const rows = await transaction.$queryRaw<
    { id: string; name: string; stockQuantity: number; isPublished: boolean }[]
  >(
    Prisma.sql`
      SELECT "id", "name", "stockQuantity", "isPublished"
      FROM "Product"
      WHERE "id" = ${productId}
      FOR UPDATE
    `,
  );
  return rows[0] ?? null;
}

async function changeQuantity(
  transaction: StockTransaction,
  input: {
    productId: string;
    productName: string;
    actorId: string | null;
    orderId?: string;
    orderItemId?: string;
    sourceKey?: string;
    reason: string;
    type: MovementType;
    quantityChange: number;
    requirePublished?: boolean;
  },
) {
  const product = await lockProduct(transaction, input.productId);
  if (!product || (input.requirePublished && !product.isPublished)) {
    throw new InsufficientProductStockError();
  }
  const quantityAfter = product.stockQuantity + input.quantityChange;
  if (quantityAfter < 0) throw new InsufficientProductStockError();
  await transaction.product.update({
    where: { id: input.productId },
    data: { stockQuantity: quantityAfter },
  });
  await transaction.productStockMovement.create({
    data: {
      productId: input.productId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      actorId: input.actorId,
      productName: input.productName,
      type: input.type,
      quantityChange: input.quantityChange,
      quantityBefore: product.stockQuantity,
      quantityAfter,
      reason: input.reason,
      sourceKey: input.sourceKey,
    },
  });
}

export async function recordOpeningStock(
  transaction: StockTransaction,
  product: { id: string; name: string; stockQuantity: number },
  actorId: string,
) {
  if (product.stockQuantity <= 0) return;
  await transaction.productStockMovement.create({
    data: {
      productId: product.id,
      actorId,
      productName: product.name,
      type: ProductStockMovementType.opening_balance,
      quantityChange: product.stockQuantity,
      quantityBefore: 0,
      quantityAfter: product.stockQuantity,
      reason: "Opening stock",
    },
  });
}

export async function recordOrderSale(
  transaction: StockTransaction,
  orderId: string,
  items: StockItem[],
  actorId: string | null,
) {
  const orderedItems = [...items].sort((a, b) =>
    (a.productId ?? "").localeCompare(b.productId ?? ""),
  );
  for (const item of orderedItems) {
    if (!item.productId) continue;
    const sourceKey = `order-item:${item.id}:sale`;
    const existing = await transaction.productStockMovement.findUnique({
      where: { sourceKey },
      select: { id: true },
    });
    if (existing) continue;
    await changeQuantity(transaction, {
      productId: item.productId,
      productName: item.productName,
      actorId,
      orderId,
      orderItemId: item.id,
      sourceKey,
      reason: `Sale for order ${orderId}`,
      type: ProductStockMovementType.sale,
      quantityChange: -item.quantity,
      requirePublished: true,
    });
  }
}

export async function reverseOrderSale(
  transaction: StockTransaction,
  orderId: string,
  items: StockItem[],
  actorId: string | null,
) {
  const orderedItems = [...items].sort((a, b) =>
    (a.productId ?? "").localeCompare(b.productId ?? ""),
  );
  for (const item of orderedItems) {
    if (!item.productId) continue;
    const saleKey = `order-item:${item.id}:sale`;
    const sale = await transaction.productStockMovement.findUnique({
      where: { sourceKey: saleKey },
      select: { id: true },
    });
    if (!sale) continue;
    const sourceKey = `order-item:${item.id}:sale-reversal`;
    const reversal = await transaction.productStockMovement.findUnique({
      where: { sourceKey },
      select: { id: true },
    });
    if (reversal) continue;
    await changeQuantity(transaction, {
      productId: item.productId,
      productName: item.productName,
      actorId,
      orderId,
      orderItemId: item.id,
      sourceKey,
      reason: `Stock returned after cancellation of order ${orderId}`,
      type: ProductStockMovementType.sale_reversal,
      quantityChange: item.quantity,
    });
  }
}

export async function adjustProductStock(
  transaction: StockTransaction,
  input: {
    productId: string;
    actorId: string;
    quantity: number;
    reason: string;
  },
) {
  const product = await lockProduct(transaction, input.productId);
  if (!product) return false;
  const quantityChange = input.quantity - product.stockQuantity;
  if (!quantityChange) return true;
  const quantityAfter = input.quantity;
  if (quantityAfter < 0) throw new InsufficientProductStockError();
  await transaction.product.update({
    where: { id: input.productId },
    data: { stockQuantity: quantityAfter },
  });
  await transaction.productStockMovement.create({
    data: {
      productId: input.productId,
      actorId: input.actorId,
      productName: product.name,
      type: ProductStockMovementType.adjustment,
      quantityChange,
      quantityBefore: product.stockQuantity,
      quantityAfter,
      reason: input.reason,
    },
  });
  return true;
}
