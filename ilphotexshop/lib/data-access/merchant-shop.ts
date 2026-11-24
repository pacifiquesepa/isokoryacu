import "server-only";

import { randomUUID } from "node:crypto";
import {
  MerchantKycAuditAction,
  MerchantKycStatus,
  ProductModerationStatus,
  UserRole,
} from "@prisma/client";
import type { Prisma, User } from "@prisma/client";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { defaultMerchantBusinessHours } from "@/lib/merchant-shop";
import { prisma } from "@/lib/prisma";
import type { MerchantShopProfileInput } from "@/lib/validation/merchant-shop";
import { merchantBusinessHoursSchema } from "@/lib/validation/merchant-shop";

type MerchantActor = Pick<User, "id" | "name" | "email" | "role">;
type ShopImage = { bytes: Uint8Array<ArrayBuffer>; mimeType: string } | null;
type VerificationRecord = {
  status: MerchantKycStatus | null;
  reviewReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
} | null;

const merchantShopProfileSelect = {
  id: true,
  merchantId: true,
  name: true,
  slug: true,
  businessCategory: true,
  description: true,
  phone: true,
  email: true,
  businessAddress: true,
  country: true,
  province: true,
  district: true,
  sector: true,
  cell: true,
  village: true,
  latitude: true,
  longitude: true,
  businessHours: true,
  logoMimeType: true,
  bannerMimeType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MerchantShopSelect;

type MerchantShopProfileRecord = Prisma.MerchantShopGetPayload<{
  select: typeof merchantShopProfileSelect;
}>;

function getVerificationStatus(
  status: MerchantKycStatus | null | undefined,
): "pending" | "approved" | "not_submitted" {
  if (status === MerchantKycStatus.approved) return "approved";
  if (status === MerchantKycStatus.pending) return "pending";
  return "not_submitted";
}

export type MerchantShopMediaUpdate = {
  logo?: ShopImage;
  banner?: ShopImage;
};

function assertMerchant(actor: MerchantActor) {
  if (actor.role !== UserRole.seller) {
    throw new AuthorizationDeniedError();
  }
}

function makeShopSlug(name: string, merchantId: string) {
  const namePart =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "shop";
  return `${namePart}-${merchantId.toLowerCase()}`.slice(0, 220);
}

function toProfileView(
  shop: MerchantShopProfileRecord,
  verification: VerificationRecord,
  reverificationRequested = false,
) {
  return {
    id: shop.id,
    merchantId: shop.merchantId,
    name: shop.name,
    slug: shop.slug,
    businessCategory: shop.businessCategory,
    description: shop.description,
    phone: shop.phone,
    email: shop.email,
    businessAddress: shop.businessAddress,
    country: shop.country,
    province: shop.province,
    district: shop.district,
    sector: shop.sector,
    cell: shop.cell,
    village: shop.village,
    latitude: shop.latitude,
    longitude: shop.longitude,
    businessHours: merchantBusinessHoursSchema.parse(shop.businessHours),
    hasLogo: Boolean(shop.logoMimeType),
    hasBanner: Boolean(shop.bannerMimeType),
    verificationStatus: getVerificationStatus(verification?.status),
    reviewReason: verification?.reviewReason ?? null,
    submittedAt: verification?.submittedAt ?? null,
    reviewedAt: verification?.reviewedAt ?? null,
    reverificationRequested,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
  };
}

export async function getMerchantShopProfile(actor: MerchantActor) {
  assertMerchant(actor);
  const verification = await prisma.merchantKyc.findUnique({
    where: { userId: actor.id },
    select: {
      status: true,
      businessName: true,
      businessAddress: true,
      reviewReason: true,
      submittedAt: true,
      reviewedAt: true,
    },
  });
  const initialName = verification?.businessName ?? actor.name;
  const shop = await prisma.merchantShop.upsert({
    where: { merchantId: actor.id },
    create: {
      merchantId: actor.id,
      name: initialName,
      slug: makeShopSlug(initialName, actor.id),
      businessCategory: "Other",
      description: null,
      phone: null,
      email: actor.email,
      businessAddress: verification?.businessAddress ?? "",
      businessHours: defaultMerchantBusinessHours,
    },
    update: {},
    select: merchantShopProfileSelect,
  });
  return toProfileView(shop, verification ?? null);
}

export async function updateMerchantShopProfile(
  actor: MerchantActor,
  input: MerchantShopProfileInput,
  media: MerchantShopMediaUpdate,
) {
  assertMerchant(actor);
  const verification = await prisma.$transaction(async (transaction) => {
    const currentVerification = await transaction.merchantKyc.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        status: true,
        businessName: true,
        businessAddress: true,
        reviewReason: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });
    const needsReverification =
      currentVerification?.status === MerchantKycStatus.approved &&
      (currentVerification.businessName !== input.name ||
        currentVerification.businessAddress !== input.businessAddress);
    const reverifyReason =
      "Shop business name or address changed; re-verification is required.";
    const mediaData = {
      ...(media.logo === undefined
        ? {}
        : {
            logoData: media.logo?.bytes ?? null,
            logoMimeType: media.logo?.mimeType ?? null,
          }),
      ...(media.banner === undefined
        ? {}
        : {
            bannerData: media.banner?.bytes ?? null,
            bannerMimeType: media.banner?.mimeType ?? null,
          }),
    };

    const shop = await transaction.merchantShop.upsert({
      where: { merchantId: actor.id },
      create: {
        ...input,
        merchantId: actor.id,
        slug: makeShopSlug(input.name, actor.id),
        ...mediaData,
      },
      update: {
        ...input,
        ...mediaData,
      },
      select: merchantShopProfileSelect,
    });

    let updatedVerification = currentVerification;
    if (currentVerification) {
      updatedVerification = await transaction.merchantKyc.update({
        where: { id: currentVerification.id },
        data: {
          businessName: input.name,
          businessAddress: input.businessAddress,
          ...(needsReverification
            ? {
                status: MerchantKycStatus.pending,
                reviewReason: reverifyReason,
                reviewedById: null,
                reviewedAt: null,
                submittedAt: new Date(),
              }
            : {}),
        },
        select: {
          id: true,
          status: true,
          businessName: true,
          businessAddress: true,
          reviewReason: true,
          submittedAt: true,
          reviewedAt: true,
        },
      });
    }

    if (needsReverification && currentVerification) {
      await transaction.merchantKycAudit.create({
        data: {
          id: randomUUID(),
          applicationId: currentVerification.id,
          actorId: actor.id,
          action: MerchantKycAuditAction.reverification_requested,
          reason: reverifyReason,
        },
      });
    }

    return { shop, updatedVerification, reverificationRequested: needsReverification };
  });
  return toProfileView(
    verification.shop,
    verification.updatedVerification ?? null,
    verification.reverificationRequested,
  );
}

export async function getMerchantShopMediaBySlug(
  slug: string,
  kind: "logo" | "banner",
) {
  const where = {
    slug,
    merchant: {
      role: UserRole.seller,
      isActive: true,
      isSuspended: false,
      isAnonymized: false,
    },
  };
  if (kind === "logo") {
    const shop = await prisma.merchantShop.findFirst({
      where,
      select: { logoData: true, logoMimeType: true },
    });
    return shop?.logoData && shop.logoMimeType
      ? { bytes: shop.logoData, mimeType: shop.logoMimeType }
      : null;
  }

  const shop = await prisma.merchantShop.findFirst({
    where,
    select: { bannerData: true, bannerMimeType: true },
  });
  return shop?.bannerData && shop.bannerMimeType
    ? { bytes: shop.bannerData, mimeType: shop.bannerMimeType }
    : null;
}

export async function getPublicMerchantShopBySlug(slug: string) {
  const shop = await prisma.merchantShop.findFirst({
    where: {
      slug,
      merchant: {
        role: UserRole.seller,
        isActive: true,
        isSuspended: false,
        isAnonymized: false,
      },
    },
    select: {
      id: true,
      merchantId: true,
      name: true,
      slug: true,
      businessCategory: true,
      description: true,
      phone: true,
      email: true,
      businessAddress: true,
      country: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      latitude: true,
      longitude: true,
      businessHours: true,
      updatedAt: true,
      logoMimeType: true,
      bannerMimeType: true,
      merchant: {
        select: {
          merchantKyc: {
            select: { status: true },
          },
          products: {
            where: {
              isPublished: true,
              moderationStatus: ProductModerationStatus.published,
            },
            orderBy: { createdAt: "desc" },
            take: 24,
            select: {
              id: true,
              name: true,
              nameRw: true,
              nameFr: true,
              image: true,
              price: true,
              previousPrice: true,
              category: true,
              categoryInfo: { select: { name: true } },
              stockQuantity: true,
            },
          },
        },
      },
    },
  });
  if (!shop) return null;

  return {
    id: shop.id,
    merchantId: shop.merchantId,
    name: shop.name,
    slug: shop.slug,
    businessCategory: shop.businessCategory,
    description: shop.description,
    phone: shop.phone,
    email: shop.email,
    businessAddress: shop.businessAddress,
    country: shop.country,
    province: shop.province,
    district: shop.district,
    sector: shop.sector,
    cell: shop.cell,
    village: shop.village,
    latitude: shop.latitude,
    longitude: shop.longitude,
    updatedAt: shop.updatedAt,
    businessHours: merchantBusinessHoursSchema.parse(shop.businessHours),
    hasLogo: Boolean(shop.logoMimeType),
    hasBanner: Boolean(shop.bannerMimeType),
    verificationStatus: getVerificationStatus(
      shop.merchant.merchantKyc?.status,
    ),
    products: shop.merchant.products,
  };
}
