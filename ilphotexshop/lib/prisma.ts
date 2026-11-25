import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function getDevelopmentDatasourceUrl() {
  if (process.env.NODE_ENV !== "development" || !process.env.DATABASE_URL) {
    return undefined;
  }

  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }
  return url.toString();
}

const datasourceUrl = getDevelopmentDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
