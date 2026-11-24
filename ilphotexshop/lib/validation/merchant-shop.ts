import { z } from "zod";
import { phoneNumberSchema } from "@/lib/validation/auth";
import { merchantShopDays, merchantShopCategories } from "@/lib/merchant-shop";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const coordinateSchema = z.number().finite();

export const merchantBusinessHoursSchema = z
  .array(
    z
      .object({
        day: z.enum(merchantShopDays),
        open: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        close: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        closed: z.boolean(),
      })
      .strict(),
  )
  .length(merchantShopDays.length)
  .superRefine((hours, context) => {
    if (new Set(hours.map((entry) => entry.day)).size !== merchantShopDays.length) {
      context.addIssue({
        code: "custom",
        message: "Business hours must include each day once",
      });
    }
  });

export const merchantShopProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    businessCategory: z.enum(merchantShopCategories),
    description: optionalText(1500),
    phone: z
      .union([phoneNumberSchema, z.literal("")])
      .transform((value) => value || null),
    email: z
      .union([z.string().trim().email().max(254), z.literal("")])
      .transform((value) => value.toLowerCase() || null),
    businessAddress: z.string().trim().min(3).max(500),
    country: z.string().trim().min(2).max(80),
    province: optionalText(120),
    district: optionalText(120),
    sector: optionalText(120),
    cell: optionalText(120),
    village: optionalText(120),
    latitude: coordinateSchema.min(-90).max(90).nullable(),
    longitude: coordinateSchema.min(-180).max(180).nullable(),
    businessHours: merchantBusinessHoursSchema,
  })
  .strict()
  .superRefine((profile, context) => {
    if ((profile.latitude === null) !== (profile.longitude === null)) {
      context.addIssue({
        code: "custom",
        message: "Enter both map coordinates or leave both blank",
        path: ["latitude"],
      });
    }
  });

export const merchantShopMediaKindSchema = z.enum(["logo", "banner"]);

export type MerchantShopProfileInput = z.infer<
  typeof merchantShopProfileSchema
>;
