import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  AlertTriangle,
  ClipboardList,
  Eye,
  Package,
  PackageCheck,
  ShoppingBag,
  Tag,
  Wallet,
} from "lucide-react";
import {
  getAuthenticatedUser,
  getMerchantWorkspacePermissions,
  requireMerchantPageUser,
} from "@/lib/authorization";
import { getMerchantDashboardData } from "@/lib/data-access/merchant-dashboard";
import { getMerchantFinanceSummary } from "@/lib/data-access/merchant-finance";
import AnnouncementFeed from "@/components/announcements/announcement-feed";

export const metadata: Metadata = {
  title: "Dashboard | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function MerchantOrderChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  const width = 620;
  const height = 190;
  const left = 32;
  const right = 594;
  const top = 20;
  const bottom = 148;
  const maximum = Math.max(...data.map((point) => point.count), 1);
  const points = data.map((point, index) => ({
    ...point,
    x: left + (index * (right - left)) / Math.max(data.length - 1, 1),
    y: bottom - (point.count / maximum) * (bottom - top),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;

  return (
    <div className="merchant-chart-container">
      <svg
        aria-labelledby="merchant-order-chart-title"
        className="merchant-activity-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="merchant-order-chart-title">
          Orders containing your products over the last seven days
        </title>
        <defs>
          <linearGradient id="merchant-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1d5ca7" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1d5ca7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[top, (top + bottom) / 2, bottom].map((y) => (
          <line
            className="merchant-chart-grid"
            key={y}
            x1={left}
            x2={right}
            y1={y}
            y2={y}
          />
        ))}
        <path d={areaPath} fill="url(#merchant-chart-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#1d5ca7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point) => (
          <g key={point.day}>
            <circle
              cx={point.x}
              cy={point.y}
              fill="#fff"
              r="4"
              stroke="#1d5ca7"
              strokeWidth="2"
            >
              <title>{`${point.count} orders on ${point.day}`}</title>
            </circle>
            <text
              className="merchant-chart-label"
              textAnchor="middle"
              x={point.x}
              y="178"
            >
              {point.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MerchantCatalogChart({
  published,
  unpublished,
}: {
  published: number;
  unpublished: number;
}) {
  const total = published + unpublished;
  const circumference = 2 * Math.PI * 45;
  const publishedLength = total
    ? (circumference * published) / total
    : 0;

  return (
    <div className="merchant-catalog-chart">
      <div className="merchant-donut-wrap">
        <svg
          aria-label={`${published} published products and ${unpublished} unpublished products`}
          className="merchant-donut"
          role="img"
          viewBox="0 0 112 112"
        >
          <circle className="merchant-donut-track" cx="56" cy="56" r="45" />
          <circle
            className="merchant-donut-published"
            cx="56"
            cy="56"
            r="45"
            strokeDasharray={`${publishedLength} ${circumference}`}
            transform="rotate(-90 56 56)"
          />
        </svg>
        <div className="merchant-donut-center">
          <strong>{numberFormat.format(total)}</strong>
          <span>products</span>
        </div>
      </div>
      <div className="merchant-chart-legend">
        <div>
          <span className="merchant-legend-dot is-published" />
          <span>Published</span>
          <strong>{numberFormat.format(published)}</strong>
        </div>
        <div>
          <span className="merchant-legend-dot is-unpublished" />
          <span>Unpublished</span>
          <strong>{numberFormat.format(unpublished)}</strong>
        </div>
      </div>
    </div>
  );
}

export default function MerchantDashboardPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading your shop…</div>}>
      <MerchantDashboardContent />
    </Suspense>
  );
}

async function MerchantDashboardContent() {
  const seller = await requireMerchantPageUser();
  const authenticatedUser = await getAuthenticatedUser();
  const permissions = authenticatedUser
    ? await getMerchantWorkspacePermissions(authenticatedUser.id)
    : null;
  const [dashboard, finance] = await Promise.all([
    getMerchantDashboardData(seller),
    getMerchantFinanceSummary(seller),
  ]);
  const { stats, orderActivity, recentProducts, recentOrders, bestSellers } =
    dashboard;

  const cards = [
    {
      label: "My products",
      value: stats.totalProducts,
      detail: `${numberFormat.format(stats.publishedProducts)} published`,
      icon: Package,
      tone: "blue",
      href: "/merchant/products",
    },
    {
      label: "Unpublished",
      value: stats.unpublishedProducts,
      detail: "Not visible in the storefront",
      icon: PackageCheck,
      tone: "yellow",
      href: "/merchant/products?status=unpublished",
    },
    {
      label: "Orders",
      value: stats.totalOrders,
      detail: `${numberFormat.format(stats.pendingOrders)} pending`,
      icon: ShoppingBag,
      tone: "green",
      href: "/merchant/orders",
    },
    {
      label: "Out of stock",
      value: stats.outOfStockProducts,
      detail: "Listings to restock",
      icon: Tag,
      tone: "red",
      href: "/merchant/products",
    },
    {
      label: "Low-stock alerts",
      value: stats.lowStockProducts,
      detail: "Products at their alert threshold",
      icon: AlertTriangle,
      tone: "red",
      href: "/merchant/inventory",
    },
    {
      label: "Available balance",
      value: finance.available,
      detail: "Eligible for payout · RWF",
      icon: Wallet,
      tone: "green",
      href: "/merchant/finance",
    },
  ];
  const role = permissions?.role ?? "owner";
  const roleCards = cards.filter((card) => {
    if (role === "owner" || role === "manager") return true;
    if (role === "operations") {
      return ["My products", "Unpublished", "Orders", "Out of stock", "Low-stock alerts"].includes(card.label);
    }
    if (role === "finance") {
      return card.label === "Available balance";
    }
    if (role === "support") {
      return card.label === "Orders";
    }
    return true;
  });
  const roleTitle: Record<string, string> = {
    owner: "Merchant Owner",
    manager: "Shop Manager",
    operations: "Operations / Inventory",
    finance: "Finance",
    support: "Customer Support",
  };

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Overview</div>
          <h1>{roleTitle[role]} · Welcome, {seller.name}</h1>
          <p>
            {role === "owner" || role === "manager"
              ? "Manage your shop across products, orders, inventory and staff."
              : role === "operations"
                ? "Manage catalog, stock and order fulfillment activities."
                : role === "finance"
                  ? "Monitor eligible earnings, payouts and financial activity."
                  : "Support customers through scoped conversations and orders."}
          </p>
        </div>
        <Link className="merchant-primary-action" href="/merchant/products/new">
          <PackageCheck size={17} />
          Add product
        </Link>
      </div>

      <AnnouncementFeed userId={seller.id} />

      <section aria-label="Shop summary" className="merchant-metrics">
        {roleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              className={`merchant-metric-card merchant-metric-card-link is-${card.tone}`}
              href={card.href}
              key={card.label}
            >
              <span className="merchant-metric-top">
                {card.label}
                <span className={`merchant-metric-icon is-${card.tone}`}>
                  <Icon aria-hidden="true" size={18} />
                </span>
              </span>
              <strong>{numberFormat.format(card.value)}</strong>
              <small>{card.detail}</small>
            </Link>
          );
        })}
      </section>

      <div className="merchant-info-banner" role="note">
        <ClipboardList aria-hidden="true" size={17} />
        Orders are shared across the marketplace. Only order items belonging to
        your shop are shown here. <Link href="/merchant/finance">View earnings and payouts</Link>.
      </div>

      <section className="merchant-dashboard-grid">
        <article className="merchant-panel">
          <div className="merchant-panel-heading">
            <div>
              <h2>Order activity</h2>
              <p>Orders containing your products · last 7 days</p>
            </div>
            <Link className="merchant-panel-link" href="/merchant/orders">
              Orders <ArrowUpRight size={15} />
            </Link>
          </div>
          <MerchantOrderChart data={orderActivity} />
        </article>

        <article className="merchant-panel merchant-catalog-panel">
          <div className="merchant-panel-heading">
            <div>
              <h2>Catalog health</h2>
              <p>Published and unpublished products</p>
            </div>
            <Link
              aria-label="View all products"
              className="merchant-panel-link"
              href="/merchant/products"
            >
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <MerchantCatalogChart
            published={stats.publishedProducts}
            unpublished={stats.unpublishedProducts}
          />
          <div className="merchant-best-sellers">
            <h3>Best sellers</h3>
            {bestSellers.length ? (
              <ol className="merchant-best-list">
                {bestSellers.map((product, index) => (
                  <li key={`${product.name}-${index}`}>
                    <span className="merchant-best-rank">{index + 1}</span>
                    <span className="merchant-best-name">{product.name}</span>
                    <span className="merchant-best-count">
                      {numberFormat.format(product.quantity)} sold
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="merchant-inline-empty">
                No order activity yet.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div>
            <h2>Recent orders</h2>
            <p>Only items sold by your shop are included.</p>
          </div>
          <Link className="merchant-panel-link" href="/merchant/orders">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>
        {recentOrders.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Your items</th>
                  <th scope="col">Your subtotal</th>
                  <th scope="col">Order status</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const sellerSubtotal = order.items.reduce(
                    (sum, item) => sum + item.merchantLineTotal,
                    0,
                  );
                  return (
                    <tr key={order.id}>
                      <td><strong>#{order.id.slice(-8).toUpperCase()}</strong></td>
                      <td>{order.items.length}</td>
                      <td>{numberFormat.format(sellerSubtotal)} RWF</td>
                      <td>
                        <span className={`merchant-status is-${order.status}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>{dateFormat.format(order.createdAt)}</td>
                      <td>
                        <Link
                          aria-label={`View order ${order.id}`}
                          className="merchant-table-action"
                          href={`/merchant/orders/${encodeURIComponent(order.id)}`}
                        >
                          <Eye aria-hidden="true" size={15} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state">
            <ShoppingBag aria-hidden="true" size={26} />
            <strong>No orders yet</strong>
            <span>Orders containing your products will show up here.</span>
          </div>
        )}
      </section>

      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div>
            <h2>Recently added products</h2>
            <p>Keep your shop catalog accurate and up to date.</p>
          </div>
          <Link className="merchant-panel-link" href="/merchant/products">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>
        {recentProducts.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Price</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="merchant-product-cell">
                        <Image
                          alt=""
                          className="merchant-product-thumb"
                          height={42}
                          src={product.image}
                          unoptimized
                          width={42}
                        />
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td>{numberFormat.format(product.price)} RWF</td>
                    <td>{numberFormat.format(product.stockQuantity)}</td>
                    <td>
                      <span className={`merchant-status is-${product.isPublished ? "published" : "unpublished"}`}>
                        {product.isPublished ? "Published" : "Unpublished"}
                      </span>
                    </td>
                    <td>
                      <Link
                        aria-label={`View product ${product.name}`}
                        className="merchant-table-action"
                        href={`/merchant/products/${encodeURIComponent(product.id)}`}
                      >
                        <Eye aria-hidden="true" size={15} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state">
            <Package aria-hidden="true" size={26} />
            <strong>Your shop is ready for its first product</strong>
            <span>Add a listing to start building your storefront catalog.</span>
            <Link className="merchant-primary-action" href="/merchant/products/new">
              <PackageCheck size={16} /> Add product
            </Link>
          </div>
        )}
      </section>

    </div>
  );
}
