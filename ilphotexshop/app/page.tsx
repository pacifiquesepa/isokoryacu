import { Suspense } from "react";
import { connection } from "next/server";
import Marketplace from "@/components/marketplace/marketplace";
import AnnouncementFeed from "@/components/announcements/announcement-feed";
import { getAuthenticatedUser } from "@/lib/authorization";
import {
  getActiveProductCategories,
  getPublishedProducts,
} from "@/lib/data-access/products";
import { getActiveStorefrontMarketing } from "@/lib/data-access/super-admin-marketing";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="catalog-loading" aria-busy="true">
          <span className="catalog-loading-mark" aria-hidden="true" />
          <p>Loading the marketplace…</p>
        </main>
      }
    >
      <ProductCatalog />
    </Suspense>
  );
}

async function ProductCatalog() {
  await connection();
  const [{ products }, categories, user, marketing] = await Promise.all([
    getPublishedProducts({ limit: 100, offset: 0 }),
    getActiveProductCategories(),
    getAuthenticatedUser(),
    getActiveStorefrontMarketing(),
  ]);

  return (
    <Marketplace
      announcementSlot={<AnnouncementFeed userId={user?.id ?? null} />}
      products={products}
      categories={categories}
      userRole={user?.role ?? null}
      marketing={marketing}
    />
  );
}
