import { z } from "zod";
import { productIdSchema } from "@/lib/validation/products";

export const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "fulfilled",
  "cancelled",
]);

export const deliveryZoneSchema = z.enum([
  "kigali",
  "outside_kigali",
  "international",
]);

export const deliverySettingsSchema = z
  .object({
    deliveryFeeRwf: z.number().int().min(0).max(10_000_000),
    etaKigali: z.string().trim().min(3).max(120),
    etaOutsideKigali: z.string().trim().min(3).max(120),
    etaInternational: z.string().trim().min(3).max(120),
  })
  .strict();

const orderItemSchema = z
  .object({
    productId: productIdSchema,
    quantity: z.number().int().min(1).max(100),
  })
  .strict();

export const createOrderSchema = z
  .object({
    couponCode: z
      .string()
      .trim()
      .regex(/^[A-Z0-9_-]+$/)
      .min(3)
      .max(64)
      .optional(),
    items: z
      .array(orderItemSchema)
      .min(1)
      .max(25)
      .refine(
        (items) =>
          new Set(items.map((item) => item.productId)).size === items.length,
        "Each product may only appear once",
      ),
    deliveryName: z.string().trim().min(2).max(100),
    deliveryPhone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^\+?[0-9][0-9 ()-]*$/)
      .refine(
        (phone) => {
          const digitCount = phone.replace(/\D/g, "").length;
          return digitCount >= 7 && digitCount <= 15;
        },
        "Phone number must contain 7 to 15 digits",
      ),
    deliveryAddress: z.string().trim().min(5).max(500),
    fulfillmentMethod: z.enum(["delivery", "pickup"]).default("delivery"),
    paymentMode: z.enum(["receipt", "cash_on_delivery"]).default("receipt"),
    deliveryZone: deliveryZoneSchema.optional(),
    pickupLocation: z.string().trim().max(500).optional(),
    deliveryLatitude: z.number().min(-90).max(90).optional(),
    deliveryLongitude: z.number().min(-180).max(180).optional(),
    notifyByEmail: z.boolean().default(false),
    notifyByWhatsapp: z.boolean().default(false),
    notificationLanguage: z.enum(["en", "fr", "rw"]).default("en"),
  })
  .strict()
  .superRefine((order, context) => {
    if (order.fulfillmentMethod === "delivery") {
      if (!order.deliveryAddress) {
        context.addIssue({
          code: "custom",
          message: "Delivery address is required",
          path: ["deliveryAddress"],
        });
      }
      if (!order.deliveryZone) {
        context.addIssue({
          code: "custom",
          message: "Delivery zone is required",
          path: ["deliveryZone"],
        });
      }
    } else if (!order.pickupLocation) {
      context.addIssue({
        code: "custom",
        message: "Pickup location is required",
        path: ["pickupLocation"],
      });
    }
  });

export const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const orderIdSchema = z.string().trim().min(1).max(100);

export const listOrdersQuerySchema = z
  .object({
    status: orderStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: orderStatusSchema,
  })
  .strict();

export const orderShipmentSchema = z
  .object({
    carrier: z.string().trim().min(2).max(160),
    trackingNumber: z.string().trim().min(2).max(160),
    status: z.enum(["processing", "shipped", "delivered"]),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const orderRefundSchema = z
  .object({
    amount: z.number().int().min(1),
    currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const orderRefundReviewSchema = z
  .object({
    action: z.enum(["approve", "reject", "refund", "cancel"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const orderDisputeSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const orderDisputeReviewSchema = z
  .object({
    action: z.enum(["review", "resolve", "close"]),
    resolution: z.string().trim().max(500).optional(),
  })
  .strict();

export const cashCollectionSchema = z
  .object({
    reference: z.string().trim().min(3).max(120).optional(),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type DeliverySettingsInput = z.infer<typeof deliverySettingsSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
