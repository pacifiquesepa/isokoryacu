import { z } from "zod";

export const merchantPayoutRequestSchema = z
  .object({
    amount: z.number().int().min(1).max(1_000_000_000),
    destinationType: z.enum(["bank", "mobile_money"]),
  })
  .strict();

const optionalAccountText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null).nullable();

export const merchantFinancialChangeSchema = z
  .object({
    accountName: z.string().trim().min(2).max(160),
    bankName: optionalAccountText(160),
    bankAccountNumber: optionalAccountText(100),
    mobileMoneyProvider: optionalAccountText(100),
    mobileMoneyNumber: optionalAccountText(32),
    currency: z.literal("RWF").default("RWF"),
  })
  .strict()
  .superRefine((value, context) => {
    const hasBankDetails = Boolean(value.bankName || value.bankAccountNumber);
    const hasMobileDetails = Boolean(
      value.mobileMoneyProvider || value.mobileMoneyNumber,
    );
    if (!hasBankDetails && !hasMobileDetails) {
      context.addIssue({
        code: "custom",
        message: "Add at least one bank or mobile money destination",
        path: ["bankAccountNumber"],
      });
    }
    if (hasBankDetails && (!value.bankName || !value.bankAccountNumber)) {
      context.addIssue({
        code: "custom",
        message: "Complete both bank name and account number",
        path: ["bankAccountNumber"],
      });
    }
    if (
      hasMobileDetails &&
      (!value.mobileMoneyProvider || !value.mobileMoneyNumber)
    ) {
      context.addIssue({
        code: "custom",
        message: "Complete both mobile money provider and number",
        path: ["mobileMoneyNumber"],
      });
    }
  });

export const merchantPayoutReviewSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("paid"),
      transactionReference: z.string().trim().min(3).max(120),
    })
    .strict(),
  z
    .object({
      action: z.literal("reject"),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
]);

export const merchantFinancialChangeReviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "reject" && (!value.reason || value.reason.length < 3)) {
      context.addIssue({
        code: "custom",
        message: "A reason is required when rejecting a change request",
        path: ["reason"],
      });
    }
  });

export type MerchantPayoutRequest = z.infer<typeof merchantPayoutRequestSchema>;
export type MerchantFinancialChange = z.infer<
  typeof merchantFinancialChangeSchema
>;
export type MerchantPayoutReview = z.infer<typeof merchantPayoutReviewSchema>;
export type MerchantFinancialChangeReview = z.infer<
  typeof merchantFinancialChangeReviewSchema
>;
