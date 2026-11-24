CREATE TYPE "OrderPaymentMode" AS ENUM ('receipt', 'cash_on_delivery');
CREATE TYPE "ProductStockMovementType" AS ENUM ('opening_balance', 'sale', 'sale_reversal', 'adjustment');
CREATE TYPE "MerchantPayoutStatus" AS ENUM ('requested', 'paid', 'rejected');
CREATE TYPE "MerchantFinancialChangeStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "ProductCategoryCatalog"
ADD COLUMN "commissionBasisPoints" INTEGER,
ADD COLUMN "lowStockThreshold" INTEGER;

ALTER TABLE "ProductSubcategory"
ADD COLUMN "commissionBasisPoints" INTEGER;

ALTER TABLE "Product"
ADD COLUMN "lowStockThreshold" INTEGER;

ALTER TABLE "Order"
ADD COLUMN "paymentMode" "OrderPaymentMode",
ADD COLUMN "cashCollectedAt" TIMESTAMP(3),
ADD COLUMN "cashCollectionReference" VARCHAR(120),
ADD COLUMN "cashCollectedById" TEXT;

CREATE INDEX "Order_paymentMode_cashCollectedAt_idx"
ON "Order"("paymentMode", "cashCollectedAt");

ALTER TABLE "OrderItem"
ADD COLUMN "merchantUnitPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "platformCommissionUnit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "merchantLineTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "platformCommissionTotal" INTEGER NOT NULL DEFAULT 0;

UPDATE "OrderItem"
SET "merchantUnitPrice" = "unitPrice",
    "merchantLineTotal" = "lineTotal";

CREATE TABLE "ProductStockMovement" (
    "id" VARCHAR(100) NOT NULL,
    "productId" VARCHAR(100),
    "orderId" VARCHAR(100),
    "orderItemId" VARCHAR(100),
    "actorId" TEXT,
    "productName" VARCHAR(160) NOT NULL,
    "type" "ProductStockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "sourceKey" VARCHAR(180),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductStockMovement_sourceKey_key"
ON "ProductStockMovement"("sourceKey");
CREATE INDEX "ProductStockMovement_productId_createdAt_idx"
ON "ProductStockMovement"("productId", "createdAt");
CREATE INDEX "ProductStockMovement_orderId_createdAt_idx"
ON "ProductStockMovement"("orderId", "createdAt");
CREATE INDEX "ProductStockMovement_actorId_createdAt_idx"
ON "ProductStockMovement"("actorId", "createdAt");

ALTER TABLE "ProductStockMovement"
ADD CONSTRAINT "ProductStockMovement_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ProductStockMovement_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ProductStockMovement_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ProductStockMovement_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ProductStockMovement" (
    "id", "productId", "productName", "type", "quantityChange",
    "quantityBefore", "quantityAfter", "reason", "createdAt"
)
SELECT
    'opening-' || md5("id"), "id", "name", 'opening_balance',
    "stockQuantity", 0, "stockQuantity",
    'Opening balance at inventory tracking rollout', CURRENT_TIMESTAMP
FROM "Product";

ALTER TABLE "Order"
ADD CONSTRAINT "Order_cashCollectedById_fkey"
FOREIGN KEY ("cashCollectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MerchantPayout" (
    "id" VARCHAR(100) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "MerchantPayoutStatus" NOT NULL DEFAULT 'requested',
    "destinationName" VARCHAR(160) NOT NULL,
    "destinationType" "PaymentAccountType" NOT NULL,
    "destinationProvider" VARCHAR(160) NOT NULL,
    "destinationNumber" VARCHAR(100) NOT NULL,
    "transactionReference" VARCHAR(120),
    "reviewNote" VARCHAR(500),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantPayout_merchantId_status_createdAt_idx"
ON "MerchantPayout"("merchantId", "status", "createdAt");
CREATE INDEX "MerchantPayout_status_requestedAt_idx"
ON "MerchantPayout"("status", "requestedAt");

ALTER TABLE "MerchantPayout"
ADD CONSTRAINT "MerchantPayout_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "MerchantPayout_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MerchantFinancialChangeRequest" (
    "id" VARCHAR(100) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "accountName" VARCHAR(160) NOT NULL,
    "bankName" VARCHAR(160),
    "bankAccountNumber" VARCHAR(100),
    "mobileMoneyProvider" VARCHAR(100),
    "mobileMoneyNumber" VARCHAR(32),
    "currency" CHAR(3) NOT NULL DEFAULT 'RWF',
    "status" "MerchantFinancialChangeStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" VARCHAR(500),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantFinancialChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantFinancialChangeRequest_merchantId_status_requestedAt_idx"
ON "MerchantFinancialChangeRequest"("merchantId", "status", "requestedAt");
CREATE INDEX "MerchantFinancialChangeRequest_status_requestedAt_idx"
ON "MerchantFinancialChangeRequest"("status", "requestedAt");

ALTER TABLE "MerchantFinancialChangeRequest"
ADD CONSTRAINT "MerchantFinancialChangeRequest_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "MerchantFinancialChangeRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
