ALTER TABLE "Product"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Product_ownerId_archivedAt_idx"
  ON "Product"("ownerId", "archivedAt");
