import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  Headphones,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import AnnouncementFeed from "@/components/announcements/announcement-feed";
import { requireCustomerPageUser } from "@/lib/authorization";
import { getCustomerDashboardSummary } from "@/lib/data-access/orders";

export const metadata = {
  title: "My account | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("en-RW");
const amountFormat = new Intl.NumberFormat("en-RW");

function CustomerOrderActivityChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const width = 620;
  const height = 220;
  const left = 54;
  const right = 596;
  const top = 18;
  const bottom = 158;
  const maximum = Math.max(...data.map((point) => point.count), 0);
  const scaleMaximum = Math.max(4, Math.ceil(maximum / 4) * 4);
  const ticks = Array.from({ length: 5 }, (_, index) => ({
    value: scaleMaximum - (scaleMaximum * index) / 4,
    y: top + ((bottom - top) * index) / 4,
  }));
  const points = data.map((point, index) => ({
    ...point,
    x: left + (index * (right - left)) / Math.max(data.length - 1, 1),
    y: bottom - (point.count / scaleMaximum) * (bottom - top),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;

  return (
    <div className="customer-order-activity-chart-wrap">
      <svg
        aria-labelledby="customer-order-activity-title"
        className="customer-order-activity-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="customer-order-activity-title">
          Orders created during the last six months
        </title>
        <defs>
          <linearGradient
            id="customer-order-chart-fill"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="var(--admin-blue)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--admin-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              className="customer-chart-gridline"
              x1={left}
              x2={right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="customer-chart-axis-label"
              textAnchor="end"
              x={left - 10}
              y={tick.y + 3}
            >
              {numberFormat.format(tick.value)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#customer-order-chart-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--admin-blue)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill="var(--surface)"
            key={point.label}
            r="4"
            stroke="var(--primary)"
            strokeWidth="2"
          >
            <title>{`${point.count} orders in ${point.label}`}</title>
          </circle>
        ))}
        {points.map((point) => (
          <text
            className="customer-chart-label"
            key={`label-${point.label}`}
            textAnchor="middle"
            x={point.x}
            y="198"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

const orderStatusLabels = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  processing: "Being prepared",
  shipped: "On the way",
  delivered: "Delivered",
  fulfilled: "Complete",
  cancelled: "Cancelled",
};

export default function CustomerAccountPage() {
  return (
    <CustomerPortalLayout active="account">
      <Suspense
        fallback={
          <div className="customer-orders-loading">Loading your account…</div>
        }
      >
        <CustomerDashboardContent />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function CustomerDashboardContent() {
  await connection();
  const customer = await requireCustomerPageUser("/account");
  const summary = await getCustomerDashboardSummary(customer.id);
  const firstName = customer.name.trim().split(/\s+/)[0] || "there";

  const stats = [
    {
      label: "Total orders",
      value: summary.totalOrders,
      detail: "Your full order history",
      icon: ShoppingBag,
      tone: "blue",
      href: "/orders",
    },
    {
      label: "In progress",
      value: summary.inProgressOrders,
      detail: "Orders being processed",
      icon: Clock3,
      tone: "yellow",
      href: "/orders",
    },
    {
      label: "Delivered",
      value: summary.completedOrders,
      detail: "Delivered or completed",
      icon: CheckCircle2,
      tone: "green",
      href: "/orders",
    },
    {
      label: "Receipts in review",
      value: summary.receiptsInReview,
      detail: "Waiting for payment review",
      icon: BellRing,
      tone: "red",
      href: "/account/payments?status=pending",
    },
  ];
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      label: new Intl.DateTimeFormat("en-RW", {
        month: "short",
        timeZone: "UTC",
      }).format(date),
      count: summary.monthlyOrders.find((month) => month.month === key)?.count ?? 0,
    };
  });
  const statusTotal = summary.statusBreakdown.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const statusColors = {
    pending: "#e5a824",
    confirmed: "#4b8bd5",
    processing: "#8065ce",
    shipped: "#2289a7",
    delivered: "#26976b",
    fulfilled: "#176749",
    cancelled: "#ca5561",
  };
  const donutRadius = 48;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const statusSegments = summary.statusBreakdown
    .filter((entry) => entry.count > 0)
    .reduce<{
      offset: number;
      segments: {
        status: keyof typeof statusColors;
        count: number;
        offset: number;
        length: number;
      }[];
    }>(
      (chart, entry) => {
        const length =
          (entry.count / Math.max(1, statusTotal)) * donutCircumference;
        return {
          offset: chart.offset + length,
          segments: [
            ...chart.segments,
            {
              status: entry.status,
              count: entry.count,
              offset: chart.offset,
              length,
            },
          ],
        };
      },
      { offset: 0, segments: [] },
    ).segments;

  return (
    <div className="customer-dashboard">
      <div className="customer-dashboard-heading">
        <div>
          <span className="customer-orders-breadcrumb">Workspace / Overview</span>
          <h1>Welcome back, {firstName}</h1>
          <p>Here&apos;s a summary of your orders, payments, and account.</p>
        </div>
        <Link className="customer-dashboard-primary" href="/">
          <ShoppingBag aria-hidden="true" size={17} />
          Browse the shop
        </Link>
      </div>

      <div className="customer-dashboard-data-note" role="note">
        <span aria-hidden="true" className="customer-dashboard-data-dot" />
        Your account overview
        <span>
          Payment receipts are reviewed manually; check their status in Payment
          history.
        </span>
      </div>

      <AnnouncementFeed userId={customer.id} />

      <section aria-label="Order overview" className="customer-dashboard-stats">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              className={`customer-dashboard-stat is-${stat.tone}`}
              href={stat.href}
              key={stat.label}
            >
              <span className={`customer-dashboard-stat-icon is-${stat.tone}`}>
                <Icon aria-hidden="true" size={19} />
              </span>
              <span className="customer-dashboard-stat-copy">
                <span>{stat.label}</span>
                <strong>{stat.value.toLocaleString("en-RW")}</strong>
                <small>{stat.detail}</small>
              </span>
            </Link>
          );
        })}
      </section>

      <section aria-label="Shopping insights" className="customer-dashboard-charts">
        <article className="customer-dashboard-section customer-dashboard-chart-card">
          <div className="customer-dashboard-section-heading">
            <div>
              <span className="customer-dashboard-eyebrow">YOUR ACTIVITY</span>
              <h2>Orders over time</h2>
            </div>
            <span className="customer-dashboard-chart-period">Last 6 months</span>
          </div>
          <CustomerOrderActivityChart data={chartMonths} />
        </article>

        <article className="customer-dashboard-section customer-dashboard-chart-card">
          <div className="customer-dashboard-section-heading">
            <div>
              <span className="customer-dashboard-eyebrow">ORDER STATUS</span>
              <h2>Your orders</h2>
            </div>
          </div>
          {statusTotal > 0 ? (
            <div className="customer-dashboard-donut-layout">
              <div className="customer-dashboard-donut-wrap">
                <svg
                  aria-label={`${statusTotal} orders by status`}
                  className="customer-dashboard-donut"
                  role="img"
                  viewBox="0 0 120 120"
                >
                  <circle
                    className="customer-dashboard-donut-track"
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    strokeWidth="11"
                  />
                  {statusSegments.map((segment) => (
                    <circle
                      cx="60"
                      cy="60"
                      fill="none"
                      key={segment.status}
                      r={donutRadius}
                      stroke={statusColors[segment.status]}
                      strokeDasharray={`${segment.length} ${donutCircumference - segment.length}`}
                      strokeDashoffset={-segment.offset}
                      strokeLinecap="butt"
                      strokeWidth="11"
                      transform="rotate(-90 60 60)"
                    >
                      <title>
                        {`${orderStatusLabels[segment.status]}: ${segment.count}`}
                      </title>
                    </circle>
                  ))}
                </svg>
                <div className="customer-dashboard-donut-center">
                  <strong>{statusTotal}</strong>
                  <span>orders</span>
                </div>
              </div>
              <ul className="customer-dashboard-legend">
                {summary.statusBreakdown
                  .filter((entry) => entry.count > 0)
                  .map((entry) => (
                    <li key={entry.status}>
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: statusColors[entry.status] }}
                      />
                      <span>{orderStatusLabels[entry.status]}</span>
                      <strong>{entry.count}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="customer-dashboard-chart-empty">
              Place an order to see your order status overview.
            </div>
          )}
        </article>
      </section>

      <section className="customer-dashboard-lower-grid">
        <article className="customer-dashboard-section customer-dashboard-links">
          <div className="customer-dashboard-section-heading">
            <div>
              <span className="customer-dashboard-eyebrow">YOUR ACCOUNT</span>
              <h2>Quick links</h2>
            </div>
          </div>
          <div className="customer-dashboard-shortcuts">
            <Link className="customer-dashboard-shortcut" href="/">
              <span className="customer-dashboard-shortcut-icon is-blue">
                <ShoppingBag aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>Browse products</strong>
                <small>Find something you love</small>
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="customer-dashboard-shortcut" href="/orders">
              <span className="customer-dashboard-shortcut-icon is-green">
                <PackageCheck aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>Order tracking</strong>
                <small>See your order status and delivery progress</small>
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="customer-dashboard-shortcut" href="/account/payments">
              <span className="customer-dashboard-shortcut-icon is-amber">
                <CreditCard aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>Payment receipts</strong>
                <small>Review status or download a submitted receipt</small>
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="customer-dashboard-shortcut" href="/account/security">
              <span className="customer-dashboard-shortcut-icon is-violet">
                <ShieldCheck aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>Account security</strong>
                <small>Review your sign-in protection</small>
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="customer-dashboard-shortcut" href="/support/all-in-one">
              <span className="customer-dashboard-shortcut-icon is-amber">
                <Headphones aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>Get support</strong>
                <small>Ask us about an order or account</small>
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </article>

        <article className="customer-dashboard-section customer-dashboard-recent">
          <div className="customer-dashboard-section-heading">
            <div>
              <span className="customer-dashboard-eyebrow">LATEST ACTIVITY</span>
              <h2>Recent orders</h2>
            </div>
            {summary.totalOrders > 0 && (
              <Link className="customer-dashboard-text-link" href="/orders">
                See all <ArrowRight aria-hidden="true" size={16} />
              </Link>
            )}
          </div>

          {summary.recentOrders.length ? (
            <div className="customer-dashboard-order-list">
              {summary.recentOrders.map((order) => {
                const latestProof = order.paymentProofs[0];
                const itemNames = order.items.map((item) => item.productName);
                const itemSummary = [
                  ...itemNames,
                  ...(order._count.items > itemNames.length
                    ? [`+${order._count.items - itemNames.length} more`]
                    : []),
                ].join(", ");

                return (
                  <article className="customer-dashboard-order" key={order.id}>
                    <div className="customer-dashboard-order-main">
                      <div className="customer-dashboard-order-title">
                        <div>
                          <strong>Order #{order.id.slice(-8).toUpperCase()}</strong>
                          <time dateTime={order.createdAt.toISOString()}>
                            {dateFormat.format(order.createdAt)}
                          </time>
                        </div>
                        <span className={`customer-order-status is-${order.status}`}>
                          {orderStatusLabels[order.status]}
                        </span>
                      </div>
                      <p>{itemSummary || `${order._count.items} products`}</p>
                      {latestProof && (
                        <span
                          className={`customer-dashboard-proof is-${latestProof.status}`}
                        >
                          Receipt {latestProof.status}
                        </span>
                      )}
                    </div>
                    <div className="customer-dashboard-order-total">
                      <span>Order total</span>
                      <strong>
                        {amountFormat.format(order.subtotal + order.deliveryFee)}{" "}
                        {order.currency}
                      </strong>
                      <Link
                        aria-label={`View order ${order.id.slice(-8).toUpperCase()}`}
                        href={`/orders/${encodeURIComponent(order.id)}`}
                      >
                        View details <ArrowRight aria-hidden="true" size={15} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="customer-dashboard-empty">
              <span>
                <ShoppingBag aria-hidden="true" size={24} />
              </span>
              <strong>Your first order starts here</strong>
              <p>Browse local products and your orders will appear on this page.</p>
              <Link className="customer-dashboard-primary" href="/">
                Start shopping <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
