import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { ClipboardList, Eye, ShoppingBag } from "lucide-react";
import {
  requireMerchantPageUser,
  requireMerchantWorkspacePermission,
} from "@/lib/authorization";
import { getMerchantOrders } from "@/lib/data-access/merchant-dashboard";

export const metadata: Metadata = {
  title: "My orders | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MerchantOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireMerchantWorkspacePermission("canManageOrders");
  return (
    <Suspense fallback={<div className="merchant-loading">Loading your orders…</div>}>
      <MerchantOrdersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MerchantOrdersContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [seller, params] = await Promise.all([
    requireMerchantPageUser(),
    searchParams,
  ]);
  const requestedStatus = typeof params.status === "string" ? params.status : "";
  const status = Object.values(OrderStatus).includes(requestedStatus as OrderStatus)
    ? (requestedStatus as OrderStatus)
    : undefined;
  const result = await getMerchantOrders(seller, status);
  const filters = [
    { label: "All orders", value: "", count: result.total },
    { label: "Pending", value: OrderStatus.pending, count: result.pending },
    { label: "Confirmed", value: OrderStatus.confirmed, count: result.confirmed },
    { label: "Processing", value: OrderStatus.processing, count: result.processing },
    { label: "Shipped", value: OrderStatus.shipped, count: result.shipped },
    { label: "Delivered", value: OrderStatus.delivered, count: result.delivered },
    { label: "Fulfilled", value: OrderStatus.fulfilled, count: result.fulfilled },
    { label: "Cancelled", value: OrderStatus.cancelled, count: result.cancelled },
  ];

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Orders</div>
          <h1>My orders</h1>
          <p>See only the items in marketplace orders that belong to your shop.</p>
        </div>
      </div>
      <div className="merchant-info-banner" role="note">
        <ClipboardList aria-hidden="true" size={17} />
        Order status is managed centrally. Customer contact and delivery details
        are not shown in the merchant workspace.
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        <nav aria-label="Filter orders" className="merchant-filter-tabs">
          {filters.map((filter) => (
            <Link
              aria-current={(status ?? "") === filter.value ? "page" : undefined}
              className={(status ?? "") === filter.value ? "is-active" : ""}
              href={
                filter.value
                  ? `/merchant/orders?status=${filter.value}`
                  : "/merchant/orders"
              }
              key={filter.label}
            >
              {filter.label}<span>{numberFormat.format(filter.count)}</span>
            </Link>
          ))}
        </nav>
        {result.orders.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Your items</th>
                  <th scope="col">Your subtotal</th>
                  <th scope="col">Status</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.map((order) => {
                  const sellerSubtotal = order.items.reduce(
                    (sum, item) => sum + item.merchantLineTotal,
                    0,
                  );
                  return (
                    <tr key={order.id}>
                      <td><strong>#{order.id.slice(-8).toUpperCase()}</strong></td>
                      <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
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
                          <Eye aria-hidden="true" size={15} /> View order
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
            <ShoppingBag aria-hidden="true" size={28} />
            <strong>No matching orders</strong>
            <span>Marketplace orders containing your products will appear here.</span>
          </div>
        )}
        {result.orders.length === 100 && result.total > 100 && (
          <p className="merchant-list-note">
            Showing up to the 100 most recent orders.
          </p>
        )}
      </section>
    </div>
  );
}
