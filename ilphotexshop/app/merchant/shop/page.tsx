import { Suspense } from "react";
import type { Metadata } from "next";
import { getMerchantShopProfile } from "@/lib/data-access/merchant-shop";
import { requireMerchantPageUser } from "@/lib/authorization";
import MerchantShopForm from "@/components/merchant/shop-form";

export const metadata: Metadata = {
  title: "My Shop | Merchant portal",
};

export default function MerchantShopPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading your shop…</div>}>
      <MerchantShopContent />
    </Suspense>
  );
}

async function MerchantShopContent() {
  const seller = await requireMerchantPageUser("/merchant/shop");
  const profile = await getMerchantShopProfile(seller);

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / My Shop</div>
          <h1>My Shop</h1>
          <p>Manage your public shop information and business hours.</p>
        </div>
      </div>
      <section className="merchant-panel merchant-form-panel merchant-shop-panel">
        <MerchantShopForm profile={profile} />
      </section>
    </div>
  );
}
