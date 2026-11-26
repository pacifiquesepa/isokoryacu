import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import MerchantShopForm from "@/components/merchant/shop-form";
import { requireMerchantPageUser } from "@/lib/authorization";
import { getMerchantShopProfile } from "@/lib/data-access/merchant-shop";

export const metadata: Metadata = { title: "Shop Location | Merchant portal" };

export default function MerchantShopLocationPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading shop location…</div>}>
      <MerchantShopLocationContent />
    </Suspense>
  );
}

async function MerchantShopLocationContent() {
  const merchant = await requireMerchantPageUser("/merchant/shop/location");
  const profile = await getMerchantShopProfile(merchant);
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / My Shop / Location</div>
          <h1><MapPin size={24} /> Shop Location</h1>
          <p>Manage country, province, district, address and map coordinates.</p>
        </div>
        <Link className="merchant-secondary-action" href="/merchant/shop">View profile</Link>
      </div>
      <section className="merchant-panel merchant-form-panel merchant-shop-panel">
        <MerchantShopForm profile={profile} />
      </section>
    </div>
  );
}
