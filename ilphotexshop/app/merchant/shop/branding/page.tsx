import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import MerchantShopForm from "@/components/merchant/shop-form";
import { requireMerchantPageUser } from "@/lib/authorization";
import { getMerchantShopProfile } from "@/lib/data-access/merchant-shop";

export const metadata: Metadata = { title: "Shop Branding | Merchant portal" };

export default function MerchantShopBrandingPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading shop branding…</div>}>
      <MerchantShopBrandingContent />
    </Suspense>
  );
}

async function MerchantShopBrandingContent() {
  const merchant = await requireMerchantPageUser("/merchant/shop/branding");
  const profile = await getMerchantShopProfile(merchant);
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / My Shop / Branding</div>
          <h1><ImageIcon size={24} /> Shop Branding</h1>
          <p>Manage shop identity, description, logo and banner.</p>
        </div>
        <Link className="merchant-secondary-action" href="/merchant/shop">View profile</Link>
      </div>
      <section className="merchant-panel merchant-form-panel merchant-shop-panel">
        <MerchantShopForm profile={profile} />
      </section>
    </div>
  );
}
