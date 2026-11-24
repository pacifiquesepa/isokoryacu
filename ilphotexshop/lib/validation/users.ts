import { z } from "zod";
import {
  phoneNumberSchema,
  registrationPasswordSchema,
} from "@/lib/validation/auth";

export const userIdSchema = z.string().trim().min(1).max(100);

export const assignableUserRoleSchema = z.enum([
  "customer",
  "seller",
  "admin",
]);

export const updateUserRoleSchema = z
  .object({ role: assignableUserRoleSchema })
  .strict();

export const updateUserProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z
      .union([phoneNumberSchema, z.literal("")])
      .transform((phone) => phone || null),
  })
  .strict();

export const updateSellerProfileSchema = updateUserProfileSchema;

const passwordInputSchema = z
  .string()
  .min(1)
  .max(72)
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72);

export const changeSuperAdminPasswordSchema = z
  .object({
    currentPassword: passwordInputSchema,
    newPassword: registrationPasswordSchema,
    confirmPassword: registrationPasswordSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (value.newPassword === value.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a password different from your current password",
        path: ["newPassword"],
      });
    }
  });

export const changeCustomerPasswordSchema = z
  .object({
    currentPassword: passwordInputSchema,
    newPassword: registrationPasswordSchema,
    confirmPassword: registrationPasswordSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (value.newPassword === value.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a password different from your current password",
        path: ["newPassword"],
      });
    }
  });

export const merchantAccessActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("suspend"),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("reactivate"),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
]);

export const userStateActionSchema = z
  .object({
    action: z.enum(["activate", "deactivate", "archive", "restore"]),
  })
  .strict();

export const createStaffInvitationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    role: z.enum(["admin"]),
  })
  .strict();

export const staffInvitationIdSchema = z.string().trim().min(1).max(100);

export const merchantStaffSchema = z
  .object({
    merchantId: userIdSchema,
    userId: userIdSchema,
    role: z.enum(["owner", "manager", "operations", "support", "finance"]),
    canManageProducts: z.boolean().optional().default(false),
    canManageOrders: z.boolean().optional().default(false),
    canManageStaff: z.boolean().optional().default(false),
    canManageFinancialProfile: z.boolean().optional().default(false),
  })
  .strict();

export const merchantStaffStatusSchema = z
  .object({
    status: z.enum(["active", "inactive"]),
  })
  .strict();

export const merchantFinancialProfileSchema = z
  .object({
    merchantId: userIdSchema,
    accountName: z.string().trim().min(2).max(160),
    bankName: z.string().trim().max(160).optional().or(z.literal("")),
    bankAccountNumber: z.string().trim().max(100).optional().or(z.literal("")),
    mobileMoneyProvider: z.string().trim().max(100).optional().or(z.literal("")),
    mobileMoneyNumber: z.string().trim().max(32).optional().or(z.literal("")),
    currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  })
  .strict();

export type AssignableUserRole = z.infer<typeof assignableUserRoleSchema>;
