import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { getMerchantPromotionData } from "@/lib/data-access/merchant-portal";

export const metadata: Metadata = { title: "Marketing & Promotions | Merchant portal" };

export default async function MerchantPromotionsPage() {
  const data = await getMerchantPromotionData();
  const featured = data.featured[0];
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Marketing & Promotions</div><h1>Marketing & Promotions</h1><p>Review platform promotions and your shop&apos;s featured status.</p></div>
      </div>
      <section className="merchant-metrics">
        <article className="merchant-metric-card is-green"><span className="merchant-metric-top">Global active coupons</span><strong>{data.coupons}</strong></article>
        <article className="merchant-metric-card is-blue"><span className="merchant-metric-top">Active/scheduled campaigns</span><strong>{data.campaigns}</strong></article>
        <article className="merchant-metric-card is-yellow"><span className="merchant-metric-top">Active homepage banners</span><strong>{data.activeBanners}</strong></article>
      </section>
      <section className="merchant-panel merchant-dashboard-section" id="featured">
        <div className="merchant-panel-heading"><div><h2><Megaphone size={18} /> Featured shop status</h2><p>Featured placement is approved and managed by Super Admin.</p></div></div>
        {featured ? (
          <dl className="merchant-detail-list">
            <div><dt>Status</dt><dd>{featured.isActive ? "Featured" : "Not featured"}</dd></div>
            <div><dt>Position</dt><dd>{featured.position}</dd></div>
            <div><dt>Starts</dt><dd>{featured.startsAt.toLocaleString("en-RW")}</dd></div>
            <div><dt>Ends</dt><dd>{featured.endsAt ? featured.endsAt.toLocaleString("en-RW") : "No end date"}</dd></div>
          </dl>
        ) : (
          <div className="merchant-empty-state"><Megaphone size={28} /><strong>Not featured</strong><span>No active or historical featured listing is assigned to this shop.</span></div>
        )}
      </section>
      <div className="merchant-info-banner" role="note">Platform-wide coupons, campaigns, shop banners and featured placement are controlled by Super Admin. Merchant-specific discount creation requires an added Prisma owner scope and will not be exposed as global promotions.</div>
    </div>
  );
}
