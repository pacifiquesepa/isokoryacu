import { z } from "zod";

export const merchantStockAdjustmentSchema = z
  .object({
    productId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type MerchantStockAdjustment = z.infer<
  typeof merchantStockAdjustmentSchema
>;
