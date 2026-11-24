import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type UserRole } from "@prisma/client";
import type { Product } from "@/data/products";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCommissionBreakdown } from "@/lib/commerce/pricing";
import {
  adjustProductStock,
  recordOpeningStock,
} from "@/lib/data-access/inventory";
import type { UploadedProductImage } from "@/lib/http/product-image-upload";
import type {
  CreateProductInput,
  CreateProductMetadataInput,
  ListProductsQuery,
  UpdateProductInput,
} from "@/lib/validation/products";
import {
  productPublicationSchema,
  productSpecificationSchema,
} from "@/lib/validation/products";

const publicProductFields = {
  id: true,
  sku: true,
  brand: true,
  subcategory: { select: { name: true, commissionBasisPoints: true } },
  name: true,
  nameFr: true,
  nameRw: true,
  description: true,
  warranty: true,
  specifications: true,
  returnPolicy: true,
  category: true,
  categoryInfo: {
    select: { name: true, commissionBasisPoints: true },
  },
  price: true,
  previousPrice: true,
  rating: true,
  reviewCount: true,
  badge: true,
  badgeFr: true,
  badgeRw: true,
  image: true,
  seller: true,
  location: true,
  stockQuantity: true,
  isFeatured: true,
  uploadedImages: {
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  },
  ownerId: true,
  owner: { select: { phone: true } },
} as const;

const managedProductFields = {
  ...publicProductFields,
  isPublished: true,
  moderationStatus: true,
  scheduledAt: true,
  moderationReason: true,
  moderatedAt: true,
  moderatedById: true,
  lowStockThreshold: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicProductRecord = Prisma.ProductGetPayload<{
  select: typeof publicProductFields;
}>;

type ProductActor = {
  id: string;
  name: string;
  role: UserRole;
};

export class InvalidProductPricingError extends Error {
  constructor() {
    super("Previous price must be greater than current price");
    this.name = "InvalidProductPricingError";
  }
}

export class SuspendedMerchantProductError extends Error {
  constructor() {
    super("Products owned by a suspended merchant cannot be published");
    this.name = "SuspendedMerchantProductError";
  }
}

export class ProductNotPublishedError extends Error {
  constructor() {
    super("Only published products can be featured");
    this.name = "ProductNotPublishedError";
  }
}

export class ProductImageUploadRequiredError extends Error {
  constructor() {
    super("Choose an image file before switching to upload");
    this.name = "ProductImageUploadRequiredError";
  }
}

export class InvalidProductSubcategoryError extends Error {
  constructor() {
    super("Choose an active subcategory that belongs to the selected category");
    this.name = "InvalidProductSubcategoryError";
  }
}

export class InvalidProductCategoryError extends Error {
  constructor() {
    super("Choose a valid product category");
    this.name = "InvalidProductCategoryError";
  }
}

export class InvalidProductScheduleError extends Error {
  constructor() {
    super("Publication time must be in the future");
    this.name = "InvalidProductScheduleError";
  }
}

export function isProductSkuUniqueConstraintError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.includes("sku")
    : typeof target === "string" && target.toLowerCase().includes("sku");
}

type ProductPublication = ReturnType<typeof productPublicationSchema.parse>;
type ProductImageChange =
  | { type: "keep" }
  | { type: "url"; url: string }
  | { type: "upload"; images: UploadedProductImage[] };

function getProductMutationData<
  T extends { specifications?: { name: string; value: string }[] | null },
>(input: T) {
  const { specifications, ...fields } = input;
  return {
    ...fields,
    ...(specifications === undefined
      ? {}
      : {
          specifications:
            specifications === null ? Prisma.DbNull : specifications,
        }),
  };
}

function getPublicationData(publication: ProductPublication) {
  if (publication.mode === "schedule") {
    const scheduledAt = publication.scheduledAt
      ? new Date(publication.scheduledAt)
      : null;
    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      throw new InvalidProductScheduleError();
    }
    return {
      isPublished: false,
      moderationStatus: "pending" as const,
      scheduledAt,
    };
  }
  return {
    isPublished: false,
    moderationStatus: publication.mode === "draft" ? ("draft" as const) : ("pending" as const),
    scheduledAt: null,
  };
}

async function assertActiveSubcategory(
  transaction: Prisma.TransactionClient,
  subcategoryId: string | null | undefined,
  category: CreateProductMetadataInput["category"],
) {
  if (!subcategoryId) return;
  const subcategory = await transaction.productSubcategory.findUnique({
    where: { id: subcategoryId },
    select: { category: true, isActive: true },
  });
  if (!subcategory || !subcategory.isActive || subcategory.category !== category) {
    throw new InvalidProductSubcategoryError();
  }
}

async function assertProductCategory(
  transaction: Prisma.TransactionClient,
  category: string,
) {
  const found = await transaction.productCategoryCatalog.findUnique({
    where: { slug: category },
    select: { slug: true },
  });
  if (!found) throw new InvalidProductCategoryError();
}

function assertCanManageProducts(actor: ProductActor) {
  if (
    actor.role !== "seller" &&
    actor.role !== "admin" &&
    actor.role !== "super_admin"
  ) {
    throw new AuthorizationDeniedError();
  }
}

function getOwnerFilter(actor: ProductActor) {
  assertCanManageProducts(actor);
  return actor.role === "seller" ? { ownerId: actor.id } : {};
}

function getProductOrder(sort: ListProductsQuery["sort"]) {
  if (sort === "price-low") return { price: "asc" as const };
  if (sort === "price-high") return { price: "desc" as const };
  if (sort === "rating") return { rating: "desc" as const };
  return { createdAt: "desc" as const };
}

async function getCustomerPriceProductIds(
  sort: "price-low" | "price-high",
  q: string,
  category: ListProductsQuery["category"],
  limit: number,
  offset: number,
) {
  const filters = [Prisma.sql`p."isPublished" = true`];
  if (category) filters.push(Prisma.sql`p."category" = ${category}`);
  const search = q.trim().replace(/[\\%_]/g, "\\$&");
  if (search) {
    const pattern = `%${search}%`;
    filters.push(Prisma.sql`(
      p."name" ILIKE ${pattern} OR
      COALESCE(p."nameFr", '') ILIKE ${pattern} OR
      COALESCE(p."nameRw", '') ILIKE ${pattern} OR
      COALESCE(p."sku", '') ILIKE ${pattern} OR
      COALESCE(p."brand", '') ILIKE ${pattern} OR
      p."seller" ILIKE ${pattern} OR
      p."location" ILIKE ${pattern}
    )`);
  }
  const direction = sort === "price-low" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT p."id"
      FROM "Product" p
      JOIN "ProductCategoryCatalog" c ON c."slug" = p."category"
      LEFT JOIN "ProductSubcategory" s ON s."id" = p."subcategoryId"
      WHERE ${Prisma.join(filters, " AND ")}
      ORDER BY
        (p."price" + CEIL(
          p."price" * COALESCE(s."commissionBasisPoints", c."commissionBasisPoints", 200) / 10000.0
        )) ${direction},
        p."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
  );
  return rows.map(({ id }) => id);
}

function getSearchFilter(q: string, category?: ListProductsQuery["category"]) {
  const search = q.trim();
  return {
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { nameFr: { contains: search, mode: "insensitive" as const } },
            { nameRw: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
            { brand: { contains: search, mode: "insensitive" as const } },
            { seller: { contains: search, mode: "insensitive" as const } },
            { location: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function getPublishedProducts({
  q = "",
  category,
  sort = "recommended",
  limit = 50,
  offset = 0,
}: Partial<ListProductsQuery> = {}): Promise<{
  products: Product[];
  total: number;
}> {
  const where = {
    isPublished: true,
    ...getSearchFilter(q, category),
  };

  let products: PublicProductRecord[];
  let total: number;
  if (sort === "price-low" || sort === "price-high") {
    const [ids, count] = await Promise.all([
      getCustomerPriceProductIds(sort, q, category, limit, offset),
      prisma.product.count({ where }),
    ]);
    const rows = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: publicProductFields,
        })
      : [];
    const byId = new Map(rows.map((product) => [product.id, product]));
    products = ids.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });
    total = count;
  } else {
    [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        select: publicProductFields,
        orderBy: getProductOrder(sort),
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);
  }

  return {
    products: products.map(({ categoryInfo, ...product }) => {
      const pricing = getCommissionBreakdown(
        product.price,
        categoryInfo.commissionBasisPoints,
        product.subcategory?.commissionBasisPoints ?? null,
      );
      const previousPrice =
        product.previousPrice === null
          ? null
          : getCommissionBreakdown(
              product.previousPrice,
              categoryInfo.commissionBasisPoints,
              product.subcategory?.commissionBasisPoints ?? null,
            ).customerPrice;
      return {
        ...product,
        price: pricing.customerPrice,
        basePrice: pricing.basePrice,
        commissionAmount: pricing.commissionAmount,
        previousPrice,
        categoryLabel: categoryInfo.name,
        subcategory: product.subcategory?.name ?? null,
        images: product.uploadedImages,
        specifications:
          product.specifications === null
            ? null
            : productSpecificationSchema.parse(product.specifications),
      };
    }),
    total,
  };
}

export async function getManagedProducts(
  actor: ProductActor,
  query: ListProductsQuery,
) {
  const where = {
    ...getOwnerFilter(actor),
    ...getSearchFilter(query.q, query.category),
  };
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: managedProductFields,
      orderBy: getProductOrder(query.sort),
      take: query.limit,
      skip: query.offset,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total };
}

export async function createSellerProduct(
  seller: ProductActor,
  input: CreateProductInput,
  publication: ProductPublication = { mode: "review", scheduledAt: null },
) {
  if (seller.role !== "seller") throw new AuthorizationDeniedError();

  return prisma.$transaction(async (transaction) => {
    await assertProductCategory(transaction, input.category);
    await assertActiveSubcategory(transaction, input.subcategoryId, input.category);
    const product = await transaction.product.create({
      data: {
        ...getProductMutationData(input),
        ...getPublicationData(publication),
        seller: seller.name,
        ownerId: seller.id,
        moderationReason: null,
        moderatedAt: null,
        moderatedById: null,
      },
      select: managedProductFields,
    });
    await recordOpeningStock(transaction, product, seller.id);
    return product;
  });
}

export async function createSellerProductWithImages(
  seller: ProductActor,
  input: CreateProductMetadataInput,
  uploadedImages: UploadedProductImage[],
  publication: ProductPublication = { mode: "review", scheduledAt: null },
) {
  if (seller.role !== "seller") throw new AuthorizationDeniedError();

  const productId = randomUUID();
  const imageIds = uploadedImages.map(() => randomUUID());
  const image = `/api/products/images/${imageIds[0]}`;

  return prisma.$transaction(async (transaction) => {
    await assertProductCategory(transaction, input.category);
    await assertActiveSubcategory(transaction, input.subcategoryId, input.category);
    await transaction.product.create({
      data: {
        id: productId,
        ...getProductMutationData(input),
        ...getPublicationData(publication),
        image,
        seller: seller.name,
        ownerId: seller.id,
      },
      select: { id: true },
    });
    await recordOpeningStock(
      transaction,
      {
        id: productId,
        name: input.name,
        stockQuantity: input.stockQuantity,
      },
      seller.id,
    );
    await transaction.productImage.createMany({
      data: uploadedImages.map((uploadedImage, sortOrder) => ({
        id: imageIds[sortOrder],
        productId,
        imageData: new Uint8Array(uploadedImage.imageData),
        mimeType: uploadedImage.mimeType,
        sortOrder,
      })),
    });
    return transaction.product.findUniqueOrThrow({
      where: { id: productId },
      select: managedProductFields,
    });
  });
}

async function deleteUnreferencedProductImages(
  transaction: Prisma.TransactionClient,
  imageIds: string[],
) {
  if (!imageIds.length) return;
  const images = await transaction.productImage.findMany({
    where: { id: { in: imageIds } },
    select: { id: true },
  });
  const imagePaths = images.map(({ id }) => `/api/products/images/${id}`);
  const referencedImages = await transaction.orderItem.findMany({
    where: { productImage: { in: imagePaths } },
    select: { productImage: true },
  });
  const referencedPaths = new Set(
    referencedImages.map(({ productImage }) => productImage),
  );
  const unusedIds = images
    .filter(({ id }) => !referencedPaths.has(`/api/products/images/${id}`))
    .map(({ id }) => id);
  if (unusedIds.length) {
    await transaction.productImage.deleteMany({
      where: { id: { in: unusedIds } },
    });
  }
}

export async function updateManagedProduct(
  actor: ProductActor,
  id: string,
  input: UpdateProductInput,
  imageChange?: ProductImageChange,
  publication: ProductPublication = { mode: "review", scheduledAt: null },
) {
  const where = { id, ...getOwnerFilter(actor) };
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE`,
    );
    const current = await transaction.product.findFirst({
      where,
      select: {
        price: true,
        previousPrice: true,
        stockQuantity: true,
        image: true,
        category: true,
        subcategoryId: true,
      },
    });
    if (!current) return null;

    const nextPrice = input.price ?? current.price;
    const nextPreviousPrice =
      input.previousPrice === undefined
        ? current.previousPrice
        : input.previousPrice;
    if (nextPreviousPrice !== null && nextPreviousPrice <= nextPrice) {
      throw new InvalidProductPricingError();
    }

    const nextCategory = input.category ?? current.category;
    if (nextCategory !== current.category) {
      await assertProductCategory(transaction, nextCategory);
    }
    const nextSubcategoryId =
      input.subcategoryId === undefined
        ? current.subcategoryId
        : input.subcategoryId;
    if (
      nextSubcategoryId !== current.subcategoryId ||
      nextCategory !== current.category
    ) {
      await assertActiveSubcategory(transaction, nextSubcategoryId, nextCategory);
    }

    const change =
      imageChange ??
      (input.image ? { type: "url" as const, url: input.image } : { type: "keep" as const });
    const { stockQuantity: requestedStock, ...productInput } = input;
    const imageIds =
      change.type === "upload" ? change.images.map(() => randomUUID()) : [];
    const result = await transaction.product.updateMany({
      where,
      data: {
        ...getProductMutationData(productInput),
        ...(change.type === "url" ? { image: change.url } : {}),
        ...(change.type === "upload" && change.images.length
          ? { image: `/api/products/images/${imageIds[0]}` }
          : {}),
        ...(actor.role === "seller" ? { isPublished: false } : {}),
        ...(actor.role === "seller" ? { isFeatured: false } : {}),
        ...(actor.role === "seller"
          ? {
              ...getPublicationData(publication),
              moderationReason: null,
              moderatedAt: null,
              moderatedById: null,
            }
          : {}),
      },
    });
    if (result.count === 0) return null;
    if (requestedStock !== undefined && requestedStock !== current.stockQuantity) {
      await adjustProductStock(transaction, {
        productId: id,
        actorId: actor.id,
        quantity: requestedStock,
        reason: "Stock quantity changed during product update",
      });
    }

    if (change.type === "upload" && change.images.length) {
      await transaction.productImage.createMany({
        data: change.images.map((uploadedImage, sortOrder) => ({
          id: imageIds[sortOrder],
          productId: id,
          imageData: new Uint8Array(uploadedImage.imageData),
          mimeType: uploadedImage.mimeType,
          sortOrder,
        })),
      });
    }
    if (change.type === "url" || (change.type === "upload" && change.images.length)) {
      const oldImages = await transaction.productImage.findMany({
        where: {
          productId: id,
          ...(imageIds.length ? { id: { notIn: imageIds } } : {}),
        },
        select: { id: true },
      });
      await deleteUnreferencedProductImages(
        transaction,
        oldImages.map(({ id: oldImageId }) => oldImageId),
      );
    }

    return transaction.product.findUnique({
      where: { id },
      select: managedProductFields,
    });
  });
}

export async function deleteManagedProduct(actor: ProductActor, id: string) {
  const where = { id, ...getOwnerFilter(actor) };
  return prisma.$transaction(async (transaction) => {
    const images = await transaction.productImage.findMany({
      where: { productId: id },
      select: { id: true },
    });
    const result = await transaction.product.deleteMany({ where });
    if (!result.count) return false;
    await deleteUnreferencedProductImages(
      transaction,
      images.map(({ id: imageId }) => imageId),
    );
    return true;
  });
}

export async function getProductImageRecord(id: string) {
  return prisma.productImage.findUnique({
    where: { id },
    select: {
      imageData: true,
      mimeType: true,
      product: {
        select: {
          ownerId: true,
          isPublished: true,
          moderationStatus: true,
          scheduledAt: true,
          image: true,
        },
      },
    },
  });
}

export async function isProductImageUsedByOrder(
  id: string,
  userId: string,
) {
  return prisma.orderItem.findFirst({
    where: {
      productImage: `/api/products/images/${id}`,
      OR: [{ sellerId: userId }, { order: { customerId: userId } }],
    },
    select: { id: true },
  });
}

export async function getActiveMerchantProductSubcategories() {
  return prisma.productSubcategory.findMany({
    where: { isActive: true },
    select: { id: true, category: true, name: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function getActiveProductCategories() {
  return prisma.productCategoryCatalog.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function publishDueScheduledProducts(now = new Date()) {
  const result = await prisma.product.updateMany({
    where: {
      moderationStatus: "scheduled",
      isPublished: false,
      scheduledAt: { lte: now },
      OR: [
        { ownerId: null },
        {
          owner: {
            is: {
              isSuspended: false,
              isAnonymized: false,
              archivedAt: null,
            },
          },
        },
      ],
    },
    data: {
      isPublished: true,
      moderationStatus: "published",
      scheduledAt: null,
      moderationReason: null,
    },
  });
  return result.count;
}

export async function setProductPublishedState(
  admin: ProductActor,
  id: string,
  isPublished: boolean,
) {
  if (admin.role !== "admin" && admin.role !== "super_admin") {
    throw new AuthorizationDeniedError();
  }

  return prisma.$transaction(async (transaction) => {
    if (isPublished) {
      const ownerRows = await transaction.$queryRaw<
        { isSuspended: boolean }[]
      >(
        Prisma.sql`
          SELECT owner."isSuspended"
          FROM "Product" product
          INNER JOIN "User" owner ON owner."id" = product."ownerId"
          WHERE product."id" = ${id}
            AND owner."role" = 'seller'::"UserRole"
          FOR UPDATE OF owner
        `,
      );
      if (ownerRows[0]?.isSuspended) {
        throw new SuspendedMerchantProductError();
      }
    }

    const result = await transaction.product.updateMany({
      where: { id },
      data: {
        isPublished,
        scheduledAt: null,
        ...(!isPublished ? { isFeatured: false } : {}),
        ...(isPublished
          ? { moderationStatus: "published" as const }
          : { moderationStatus: "hidden" as const }),
      },
    });
    return result.count > 0;
  });
}

export async function moderateProductAsSuperAdmin(
  actorId: string,
  id: string,
  action: "approve" | "reject",
  reason?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        isPublished: true,
        moderationStatus: true,
        scheduledAt: true,
      },
    });
    if (!product) return null;

    if (action === "approve") {
      if (product.ownerId) {
        const owner = await transaction.user.findUnique({
          where: { id: product.ownerId },
          select: { role: true, isSuspended: true, isAnonymized: true, archivedAt: true },
        });
        if (
          owner?.role === "seller" &&
          (owner.isSuspended || owner.isAnonymized || owner.archivedAt)
        ) {
          throw new SuspendedMerchantProductError();
        }
      }
    }

    const shouldSchedule =
      action === "approve" &&
      product.scheduledAt !== null &&
      product.scheduledAt.getTime() > Date.now();
    await transaction.product.update({
      where: { id },
      data: action === "approve"
        ? {
            isPublished: !shouldSchedule,
            moderationStatus: shouldSchedule ? "scheduled" : "published",
            scheduledAt: shouldSchedule ? product.scheduledAt : null,
            moderationReason: null,
            moderatedAt: new Date(),
            moderatedById: actorId,
          }
        : {
            isPublished: false,
            isFeatured: false,
            moderationStatus: "rejected",
            scheduledAt: null,
            moderationReason: reason!,
            moderatedAt: new Date(),
            moderatedById: actorId,
          },
    });
    return { id, action };
  });
}

export async function setSuperAdminProductFeaturedState(
  id: string,
  isFeatured: boolean,
) {
  if (!isFeatured) {
    const result = await prisma.product.updateMany({
      where: { id },
      data: { isFeatured: false },
    });
    return result.count > 0;
  }

  const result = await prisma.product.updateMany({
    where: { id, isPublished: true },
    data: { isFeatured: true },
  });
  if (result.count > 0) return true;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!product) return false;
  throw new ProductNotPublishedError();
}
