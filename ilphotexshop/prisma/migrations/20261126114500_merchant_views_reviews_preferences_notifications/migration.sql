CREATE TABLE "ProductView" (
    "id" VARCHAR(100) NOT NULL,
    "productId" VARCHAR(100) NOT NULL,
    "viewerId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductReview" (
    "id" VARCHAR(100) NOT NULL,
    "productId" VARCHAR(100) NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPreference" (
    "merchantId" TEXT NOT NULL,
    "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificationInApp" BOOLEAN NOT NULL DEFAULT true,
    "notificationWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "appearance" VARCHAR(20) NOT NULL DEFAULT 'system',
    "language" VARCHAR(2) NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantPreference_pkey" PRIMARY KEY ("merchantId")
);

CREATE TABLE "MerchantNotification" (
    "id" VARCHAR(100) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "linkUrl" VARCHAR(2048),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductView_productId_viewedAt_idx" ON "ProductView"("productId", "viewedAt");
CREATE INDEX "ProductView_viewerId_viewedAt_idx" ON "ProductView"("viewerId", "viewedAt");
CREATE UNIQUE INDEX "ProductReview_productId_reviewerId_key" ON "ProductReview"("productId", "reviewerId");
CREATE INDEX "ProductReview_productId_createdAt_idx" ON "ProductReview"("productId", "createdAt");
CREATE INDEX "ProductReview_reviewerId_createdAt_idx" ON "ProductReview"("reviewerId", "createdAt");
CREATE INDEX "MerchantNotification_merchantId_readAt_createdAt_idx" ON "MerchantNotification"("merchantId", "readAt", "createdAt");
CREATE INDEX "MerchantNotification_merchantId_createdAt_idx" ON "MerchantNotification"("merchantId", "createdAt");

ALTER TABLE "ProductView"
ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductView"
ADD CONSTRAINT "ProductView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductReview"
ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReview"
ADD CONSTRAINT "ProductReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPreference"
ADD CONSTRAINT "MerchantPreference_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantNotification"
ADD CONSTRAINT "MerchantNotification_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductFavorite" (
    "id" VARCHAR(100) NOT NULL,
    "productId" VARCHAR(100) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductFavorite_productId_userId_key" ON "ProductFavorite"("productId", "userId");
CREATE INDEX "ProductFavorite_productId_createdAt_idx" ON "ProductFavorite"("productId", "createdAt");
CREATE INDEX "ProductFavorite_userId_createdAt_idx" ON "ProductFavorite"("userId", "createdAt");
ALTER TABLE "ProductFavorite"
ADD CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFavorite"
ADD CONSTRAINT "ProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
