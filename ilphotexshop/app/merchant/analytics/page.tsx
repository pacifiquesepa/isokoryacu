import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartNoAxesCombined, Package, ShoppingBag, Star } from "lucide-react";
import { requireMerchantPageUser } from "@/lib/authorization";
import { getMerchantAnalyticsData } from "@/lib/data-access/merchant-dashboard";

export const metadata: Metadata = {
  title: "Product Analytics | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");

export default function MerchantAnalyticsPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading analytics…</div>}>
      <MerchantAnalyticsContent />
    </Suspense>
  );
}

async function MerchantAnalyticsContent() {
  const merchant = await requireMerchantPageUser();
  const data = await getMerchantAnalyticsData(merchant);

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Product Analytics</div>
          <h1>Product Analytics</h1>
          <p>Verified sales, revenue, units and ratings · {data.period}</p>
        </div>
      </div>
      <section aria-label="Analytics summary" className="merchant-metrics">
        <article className="merchant-metric-card is-blue">
          <span className="merchant-metric-top">Product views</span>
          <strong>{numberFormat.format(data.productViews)}</strong>
          <small>Recorded storefront views · last 30 days</small>
        </article>
        <article className="merchant-metric-card is-purple">
          <span className="merchant-metric-top">New reviews</span>
          <strong>{numberFormat.format(data.productReviews)}</strong>
          <small>Customer ratings received · last 30 days</small>
        </article>
        <article className="merchant-metric-card is-yellow">
          <span className="merchant-metric-top">Wishlist</span>
          <strong>{numberFormat.format(data.favorites)}</strong>
          <small>Products currently saved by customers</small>
        </article>
        <article className="merchant-metric-card is-green">
          <span className="merchant-metric-top">View-to-sale</span>
          <strong>{data.conversionRate.toFixed(2)}%</strong>
          <small>Completed orders divided by recorded views</small>
        </article>
        <article className="merchant-metric-card is-blue">
          <span className="merchant-metric-top">
            Revenue
            <span className="merchant-metric-icon is-blue"><ChartNoAxesCombined size={18} /></span>
          </span>
          <strong>{numberFormat.format(data.totalRevenue)} RWF</strong>
          <small>Your item revenue, excluding cancellations</small>
        </article>
        <article className="merchant-metric-card is-green">
          <span className="merchant-metric-top">
            Units sold
            <span className="merchant-metric-icon is-green"><ShoppingBag size={18} /></span>
          </span>
          <strong>{numberFormat.format(data.totalUnits)}</strong>
          <small>Across {numberFormat.format(data.salesOrders)} active orders</small>
        </article>
        <article className="merchant-metric-card is-yellow">
          <span className="merchant-metric-top">
            Average rating
            <span className="merchant-metric-icon is-yellow"><Star size={18} /></span>
          </span>
          <strong>{data.averageRating.toFixed(1)} / 5</strong>
          <small>Across rated products</small>
        </article>
        <article className="merchant-metric-card is-red">
          <span className="merchant-metric-top">
            Cancelled orders
            <span className="merchant-metric-icon is-red"><Package size={18} /></span>
          </span>
          <strong>{numberFormat.format(data.cancelledOrders)}</strong>
          <small>Excluded from revenue</small>
        </article>
      </section>

      <section className="merchant-panel merchant-dashboard-section" id="best-sellers">
        <div className="merchant-panel-heading">
          <div>
            <h2>Best sellers</h2>
            <p>Products ranked by verified item revenue.</p>
          </div>
        </div>
        {data.bestSellers.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Units sold</th>
                  <th scope="col">Order lines</th>
                  <th scope="col">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.bestSellers.map((product) => (
                  <tr key={product.id}>
                    <td><strong>{product.name}</strong></td>
                    <td>{numberFormat.format(product.quantity)}</td>
                    <td>{numberFormat.format(product.orders)}</td>
                    <td>{numberFormat.format(product.revenue)} RWF</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state">
            <ChartNoAxesCombined aria-hidden="true" size={28} />
            <strong>No sales in this period</strong>
            <span>Sales analytics will appear after the first verified order.</span>
          </div>
        )}
      </section>

      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div>
            <h2>Catalog performance</h2>
            <p>Ratings and inventory for all your listings.</p>
          </div>
        </div>
        {data.products.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Reviews</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Visibility</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((product) => (
                  <tr key={product.id}>
                    <td><strong>{product.name}</strong></td>
                    <td>{product.rating.toFixed(1)} / 5</td>
                    <td>{numberFormat.format(product.reviewCount)}</td>
                    <td>{numberFormat.format(product.stockQuantity)}</td>
                    <td>
                      <span className={`merchant-status is-${product.isPublished ? "published" : "unpublished"}`}>
                        {product.isPublished ? "Published" : "Unpublished"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state">
            <Package aria-hidden="true" size={28} />
            <strong>No catalog data yet</strong>
            <span>Add products to start measuring catalog performance.</span>
          </div>
        )}
      </section>

      <div className="merchant-info-banner" role="note">
        Cart abandonment and most wishlists are not stored yet. Views, favorites, reviews, fulfilled revenue and delivered/fulfilled sales are calculated from recorded data.
      </div>
    </div>
  );
}
