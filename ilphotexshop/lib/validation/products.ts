import { z } from "zod";

export const productCategorySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const productCategoryCreateSchema = z
  .object({
    slug: productCategorySchema,
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).transform((value) => value || null).nullable().optional(),
    commissionBasisPoints: z.number().int().min(0).max(10_000).nullable().optional(),
    lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable().optional(),
  })
  .strict();

export const productCategoryUpdateSchema = z
  .object({
    slug: productCategorySchema,
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).transform((value) => value || null).nullable().optional(),
    commissionBasisPoints: z.number().int().min(0).max(10_000).nullable().optional(),
    lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable().optional(),
  })
  .strict();

export const listProductsQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    category: productCategorySchema.optional(),
    sort: z.enum(["recommended", "price-low", "price-high", "rating"]).default(
      "recommended",
    ),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();

const productImageSchema = z
  .url()
  .max(2048)
  .refine((image) => {
    const url = new URL(image);
    return (
      url.protocol === "https:" &&
      url.hostname === "images.unsplash.com" &&
      !url.username &&
      !url.password
    );
  }, "Image URL must use the approved HTTPS image host");

export const productSpecificationSchema = z
  .array(
    z
      .object({
        name: z.string().trim().min(1).max(80),
        value: z.string().trim().min(1).max(500),
      })
      .strict(),
  )
  .max(30);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

const productFieldsSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  brand: optionalText(120),
  subcategoryId: z.string().trim().min(1).max(100).nullable().optional(),
  name: z.string().trim().min(2).max(160),
  nameFr: z.string().trim().min(1).max(160).nullable().optional(),
  nameRw: z.string().trim().min(1).max(160).nullable().optional(),
  description: optionalText(10000),
  warranty: optionalText(1000),
  specifications: productSpecificationSchema.nullable().optional(),
  returnPolicy: optionalText(2000),
  category: productCategorySchema,
  price: z.number().int().min(1).max(1_000_000_000),
  previousPrice: z
    .number()
    .int()
    .min(1)
    .max(1_000_000_000)
    .nullable()
    .optional(),
  image: productImageSchema,
  location: z.string().trim().min(2).max(120),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export const createProductSchema = productFieldsSchema
  .strict()
  .refine(
    ({ price, previousPrice }) =>
      previousPrice == null || previousPrice > price,
    {
      path: ["previousPrice"],
      message: "Previous price must be greater than current price",
    },
  );

export const createProductMetadataSchema = productFieldsSchema
  .omit({ image: true })
  .strict()
  .refine(
    ({ price, previousPrice }) =>
      previousPrice == null || previousPrice > price,
    {
      path: ["previousPrice"],
      message: "Previous price must be greater than current price",
    },
  );

export const updateProductSchema = productFieldsSchema
  .partial()
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, {
    message: "At least one product field must be provided",
  });

export const publishProductSchema = z
  .object({ isPublished: z.boolean() })
  .strict();

export const moderateProductSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "reject" && (!value.reason || value.reason.length < 3)) {
      context.addIssue({
        code: "custom",
        message: "A rejection reason is required",
        path: ["reason"],
      });
    }
  });

export const featureProductSchema = z
  .object({ isFeatured: z.boolean() })
  .strict();

export const productIdSchema = z.string().trim().min(1).max(100);

export const productScheduleSchema = z
  .object({
    scheduledAt: z.string().datetime().nullable(),
  })
  .strict();

export const productPublicationSchema = z
  .object({
    mode: z.enum(["draft", "review", "schedule"]),
    scheduledAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine(({ mode, scheduledAt }, context) => {
    if (mode === "schedule" && !scheduledAt) {
      context.addIssue({
        code: "custom",
        message: "Choose a publication date and time",
        path: ["scheduledAt"],
      });
    }
    if (mode !== "schedule" && scheduledAt) {
      context.addIssue({
        code: "custom",
        message: "A publication date is only valid for a scheduled listing",
        path: ["scheduledAt"],
      });
    }
  });

export const productSubcategorySchema = z
  .object({
    id: z.string().trim().min(1).max(100).optional(),
    category: productCategorySchema,
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    commissionBasisPoints: z.number().int().min(0).max(10_000).nullable().optional(),
  })
  .strict();

export const createProductSubcategorySchema = productSubcategorySchema.omit({
  id: true,
});

export const productReportSchema = z
  .object({
    productId: productIdSchema,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const productReportReviewSchema = z
  .object({
    action: z.enum(["review", "dismiss"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateProductMetadataInput = z.infer<
  typeof createProductMetadataSchema
>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
