ALTER TYPE "MerchantKycAuditAction"
ADD VALUE 'reverification_requested';

CREATE TABLE "MerchantShop" (
    "id" VARCHAR(100) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "businessCategory" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1500),
    "phone" VARCHAR(32),
    "email" VARCHAR(254),
    "businessAddress" VARCHAR(500) NOT NULL,
    "country" VARCHAR(80) NOT NULL DEFAULT 'Rwanda',
    "province" VARCHAR(120),
    "district" VARCHAR(120),
    "sector" VARCHAR(120),
    "cell" VARCHAR(120),
    "village" VARCHAR(120),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "businessHours" JSONB NOT NULL,
    "logoData" BYTEA,
    "logoMimeType" VARCHAR(32),
    "bannerData" BYTEA,
    "bannerMimeType" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantShop_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantShop_merchantId_fkey"
      FOREIGN KEY ("merchantId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MerchantShop_merchantId_key"
ON "MerchantShop"("merchantId");

CREATE UNIQUE INDEX "MerchantShop_slug_key"
ON "MerchantShop"("slug");

CREATE INDEX "MerchantShop_name_idx"
ON "MerchantShop"("name");
