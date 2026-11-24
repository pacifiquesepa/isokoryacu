import { PrismaClient } from "@prisma/client";
import { products } from "../data/products";

const prisma = new PrismaClient();

async function main() {
  for (const product of products) {
    const { subcategory, images, specifications, ...seedableProduct } = product;
    void subcategory;
    void images;
    const seedableFields = {
      ...seedableProduct,
      ...(specifications == null ? {} : { specifications }),
    };
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        ...seedableFields,
        previousPrice: product.previousPrice ?? null,
        badge: product.badge ?? null,
        badgeFr: product.badgeFr ?? null,
        badgeRw: product.badgeRw ?? null,
        stockQuantity: product.stockQuantity ?? 0,
        isPublished: true,
      },
      update: {
        ...seedableFields,
        previousPrice: product.previousPrice ?? null,
        badge: product.badge ?? null,
        badgeFr: product.badgeFr ?? null,
        badgeRw: product.badgeRw ?? null,
        stockQuantity: product.stockQuantity ?? 0,
        isPublished: true,
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Failed to seed marketplace products", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
