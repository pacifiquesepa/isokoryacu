import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^\+?[0-9][0-9 ()-]*$/)
  .refine((phone) => {
    const digitCount = phone.replace(/\D/g, "").length;
    return digitCount >= 7 && digitCount <= 15;
  }, "Phone number must contain 7 to 15 digits");

export const registrationPasswordSchema = z
  .string()
  .min(12)
  .max(72)
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72);

const passwordSchema = z
  .string()
  .max(72)
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: phoneNumberSchema,
    password: registrationPasswordSchema,
    confirmPassword: registrationPasswordSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export const credentialsSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema.min(1),
    totpCode: z.string().regex(/^[0-9]{6}$/).optional(),
    emailOtpCode: z.string().regex(/^[0-9]{6}$/).optional(),
  })
  .strict();
