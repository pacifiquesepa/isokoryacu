CREATE TYPE "MerchantStaffAuditAction" AS ENUM ('assigned', 'permissions_updated', 'suspended', 'activated', 'removed');

CREATE TABLE "MerchantStaffAudit" (
    "id" VARCHAR(100) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "MerchantStaffAuditAction" NOT NULL,
    "detail" VARCHAR(1000) NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantStaffAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantStaffAudit_merchantId_createdAt_idx" ON "MerchantStaffAudit"("merchantId", "createdAt");
CREATE INDEX "MerchantStaffAudit_actorId_createdAt_idx" ON "MerchantStaffAudit"("actorId", "createdAt");
CREATE INDEX "MerchantStaffAudit_targetId_createdAt_idx" ON "MerchantStaffAudit"("targetId", "createdAt");
CREATE INDEX "MerchantStaffAudit_action_createdAt_idx" ON "MerchantStaffAudit"("action", "createdAt");

ALTER TABLE "MerchantStaffAudit"
ADD CONSTRAINT "MerchantStaffAudit_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantStaffAudit"
ADD CONSTRAINT "MerchantStaffAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantStaffAudit"
ADD CONSTRAINT "MerchantStaffAudit_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
