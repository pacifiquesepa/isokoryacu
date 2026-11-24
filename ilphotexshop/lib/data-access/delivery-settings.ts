import "server-only";

import { prisma } from "@/lib/prisma";
import type { DeliverySettingsInput } from "@/lib/validation/orders";

const settingsId = "default";

export const defaultDeliverySettings = {
  id: settingsId,
  deliveryFeeRwf: 0,
  etaKigali: "2h-1 day",
  etaOutsideKigali: "4h-2 days",
  etaInternational: "1-4 days",
};

export async function getDeliverySettings() {
  const settings = await prisma.deliverySettings.findUnique({
    where: { id: settingsId },
    select: {
      id: true,
      deliveryFeeRwf: true,
      etaKigali: true,
      etaOutsideKigali: true,
      etaInternational: true,
    },
  });
  return settings ?? defaultDeliverySettings;
}

export async function updateDeliverySettings(input: DeliverySettingsInput) {
  return prisma.deliverySettings.upsert({
    where: { id: settingsId },
    create: { id: settingsId, ...input },
    update: input,
    select: {
      id: true,
      deliveryFeeRwf: true,
      etaKigali: true,
      etaOutsideKigali: true,
      etaInternational: true,
      updatedAt: true,
    },
  });
}
