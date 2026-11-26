ALTER TABLE "User"
  ADD COLUMN "emailTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailTwoFactorPendingCodeHash" CHAR(64),
  ADD COLUMN "emailTwoFactorPendingExpiresAt" TIMESTAMP(3);
