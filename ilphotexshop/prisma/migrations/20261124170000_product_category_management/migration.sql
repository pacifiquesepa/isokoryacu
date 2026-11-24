CREATE TABLE "ProductCategoryCatalog" (
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductCategoryCatalog_pkey" PRIMARY KEY ("slug")
);

CREATE UNIQUE INDEX "ProductCategoryCatalog_name_key"
ON "ProductCategoryCatalog"("name");

INSERT INTO "ProductCategoryCatalog" ("slug", "name", "createdAt", "updatedAt")
VALUES
    ('technology', 'Technology', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('fashion', 'Fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('home', 'Home', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('beauty', 'Beauty', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Product"
ALTER COLUMN "category" TYPE VARCHAR(80) USING "category"::text;

ALTER TABLE "ProductSubcategory"
ALTER COLUMN "category" TYPE VARCHAR(80) USING "category"::text;

ALTER TABLE "Product"
DROP CONSTRAINT "Product_subcategoryId_fkey";

ALTER TABLE "Product"
ADD CONSTRAINT "Product_subcategoryId_fkey"
FOREIGN KEY ("subcategoryId") REFERENCES "ProductSubcategory"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_category_fkey"
FOREIGN KEY ("category") REFERENCES "ProductCategoryCatalog"("slug")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductSubcategory"
ADD CONSTRAINT "ProductSubcategory_category_fkey"
FOREIGN KEY ("category") REFERENCES "ProductCategoryCatalog"("slug")
ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE "ProductCategory";
