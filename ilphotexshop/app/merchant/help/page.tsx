import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";

export const metadata: Metadata = { title: "Help & Support | Merchant portal" };

export default function MerchantHelpPage() {
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Help & Support</div><h1>Help & Support</h1><p>Merchant documentation and support resources.</p></div></div>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2><LifeBuoy size={18} /> Common merchant help</h2></div></div>
        <div className="merchant-help-grid">
          <article><h3>Products</h3><p>Add accurate listings, save drafts, request review, schedule publication and manage inventory.</p><Link className="merchant-panel-link" href="/merchant/products">Open products</Link></article>
          <article><h3>Orders</h3><p>Review only orders containing your products and update permitted fulfillment statuses.</p><Link className="merchant-panel-link" href="/merchant/orders">Open orders</Link></article>
          <article><h3>Finance</h3><p>Review eligible earnings and submit payout requests through verified payout accounts.</p><Link className="merchant-panel-link" href="/merchant/finance">Open finance</Link></article>
          <article><h3>Support</h3><p>Review support tickets and scoped customer conversations from the Messages section.</p><Link className="merchant-panel-link" href="/merchant/support">Open tickets</Link></article>
        </div>
      </section>
      <div className="merchant-info-banner" role="note">Live support phone and email values remain centralized in Super Admin system settings until dedicated merchant help contacts are connected to a data model.</div>
    </div>
  );
}
