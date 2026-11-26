ALTER TABLE "StaffInvitation"
  ADD COLUMN "merchantId" TEXT,
  ADD COLUMN "merchantRole" "MerchantStaffRole",
  ADD COLUMN "canManageProducts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canManageOrders" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canManageStaff" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canManageFinancialProfile" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "StaffInvitation_merchantId_status_idx"
  ON "StaffInvitation"("merchantId", "status");
