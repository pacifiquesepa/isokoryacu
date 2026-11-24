import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, Eye, ReceiptText } from "lucide-react";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import { requireCustomerPageUser } from "@/lib/authorization";
import { getCustomerPaymentProofs } from "@/lib/data-access/order-payment-proofs";
import { customerPaymentProofQuerySchema } from "@/lib/validation/payment-proofs";

export const metadata: Metadata = {
  title: "Payments & receipts | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const pageSize = 20;
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const amountFormat = new Intl.NumberFormat("en-RW");
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CustomerPaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <CustomerPortalLayout active="payments">
      <Suspense
        fallback={
          <div className="customer-orders-loading">Loading your receipts…</div>
        }
      >
        <CustomerPaymentsContent searchParams={searchParams} />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function CustomerPaymentsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const [customer, params] = await Promise.all([
    requireCustomerPageUser("/account/payments"),
    searchParams,
  ]);
  const parsedQuery = customerPaymentProofQuerySchema.safeParse({
    status: typeof params.status === "string" ? params.status : undefined,
    offset: typeof params.offset === "string" ? params.offset : 0,
  });
  const filters = parsedQuery.success
    ? parsedQuery.data
    : customerPaymentProofQuerySchema.parse({});
  const result = await getCustomerPaymentProofs(
    customer.id,
    filters.status === "all" ? undefined : filters.status,
    filters.offset,
    pageSize,
  );
  const totalReceipts = result.pending + result.approved + result.rejected;

  function pageHref(offset: number, status = filters.status) {
    const search = new URLSearchParams();
    if (status !== "all") search.set("status", status);
    if (offset > 0) search.set("offset", String(offset));
    const queryString = search.toString();
    return queryString
      ? `/account/payments?${queryString}`
      : "/account/payments";
  }

  const statusFilters = [
    { value: "all", label: "All receipts", count: totalReceipts },
    { value: "pending", label: "Pending review", count: result.pending },
    { value: "approved", label: "Approved", count: result.approved },
    { value: "rejected", label: "Needs attention", count: result.rejected },
  ] as const;

  return (
    <div className="customer-orders-page customer-payments-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">Account / Payments</span>
          <h1>Payments &amp; receipts</h1>
          <p>Review submitted receipts and their payment review status.</p>
        </div>
        <Link className="customer-orders-back" href="/orders">
          <ArrowLeft aria-hidden="true" size={16} /> View orders
        </Link>
      </div>

      <section aria-label="Payment summary" className="customer-payment-stats">
        <Link
          aria-current={filters.status === "all" ? "page" : undefined}
          className="customer-payment-stat-card is-blue"
          href={pageHref(0, "all")}
        >
          <span className="customer-payment-stat-icon is-blue">
            <ReceiptText aria-hidden="true" size={18} />
          </span>
          <div className="customer-payment-stat-copy">
            <small>All receipts</small>
            <strong>{totalReceipts}</strong>
            <span>Across your orders</span>
          </div>
        </Link>
        <Link
          aria-current={filters.status === "pending" ? "page" : undefined}
          className="customer-payment-stat-card is-yellow"
          href={pageHref(0, "pending")}
        >
          <span className="customer-payment-stat-icon is-amber">
            <ReceiptText aria-hidden="true" size={18} />
          </span>
          <div className="customer-payment-stat-copy">
            <small>Pending review</small>
            <strong>{result.pending}</strong>
            <span>Awaiting review</span>
          </div>
        </Link>
        <Link
          aria-current={filters.status === "approved" ? "page" : undefined}
          className="customer-payment-stat-card is-green"
          href={pageHref(0, "approved")}
        >
          <span className="customer-payment-stat-icon is-green">
            <ReceiptText aria-hidden="true" size={18} />
          </span>
          <div className="customer-payment-stat-copy">
            <small>Approved</small>
            <strong>{result.approved}</strong>
            <span>Accepted receipts</span>
          </div>
        </Link>
        <Link
          aria-current={filters.status === "rejected" ? "page" : undefined}
          className="customer-payment-stat-card is-red"
          href={pageHref(0, "rejected")}
        >
          <span className="customer-payment-stat-icon is-red">
            <ReceiptText aria-hidden="true" size={18} />
          </span>
          <div className="customer-payment-stat-copy">
            <small>Needs attention</small>
            <strong>{result.rejected}</strong>
            <span>Review required</span>
          </div>
        </Link>
      </section>

      <section className="customer-orders-panel customer-payments-panel">
        <nav aria-label="Filter payment receipts" className="customer-orders-filters">
          {statusFilters.map((filter) => (
            <Link
              aria-current={filters.status === filter.value ? "page" : undefined}
              className={filters.status === filter.value ? "is-active" : ""}
              href={pageHref(0, filter.value)}
              key={filter.value}
            >
              {filter.label} <span>{filter.count}</span>
            </Link>
          ))}
        </nav>

        {result.rows.length ? (
          <>
            <div className="customer-orders-table-wrap customer-orders-desktop">
              <table className="customer-orders-table customer-payments-table">
                <thead>
                  <tr>
                    <th scope="col">Receipt</th>
                    <th scope="col">Order</th>
                    <th scope="col">Method</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((proof) => (
                    <tr key={proof.id}>
                      <td><strong>#{proof.id.slice(-8).toUpperCase()}</strong></td>
                      <td>#{proof.order.id.slice(-8).toUpperCase()}</td>
                      <td>
                        {proof.method === "bank_transfer"
                          ? "Bank transfer"
                          : "Mobile money"}
                      </td>
                      <td>
                        {amountFormat.format(proof.amount)} {proof.currency}
                      </td>
                      <td>{dateFormat.format(proof.createdAt)}</td>
                      <td>
                        <span className={`customer-payment-proof-status is-${proof.status}`}>
                          {proof.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          aria-label={`View receipt ${proof.id}`}
                          className="customer-order-view"
                          href={`/account/payments/${encodeURIComponent(proof.id)}`}
                        >
                          <Eye aria-hidden="true" size={15} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="customer-orders-cards customer-payment-cards">
              {result.rows.map((proof) => (
                <article className="customer-order-card" key={proof.id}>
                  <div className="customer-order-card-heading">
                    <div>
                      <strong>Receipt #{proof.id.slice(-8).toUpperCase()}</strong>
                      <time dateTime={proof.createdAt.toISOString()}>
                        {dateFormat.format(proof.createdAt)}
                      </time>
                    </div>
                    <span className={`customer-payment-proof-status is-${proof.status}`}>
                      {proof.status}
                    </span>
                  </div>
                  <div className="customer-order-card-details">
                    <div>
                      <span>Order</span>
                      <strong>#{proof.order.id.slice(-8).toUpperCase()}</strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>
                        {amountFormat.format(proof.amount)} {proof.currency}
                      </strong>
                    </div>
                  </div>
                  <Link
                    className="customer-order-card-action"
                    href={`/account/payments/${encodeURIComponent(proof.id)}`}
                  >
                    <Eye aria-hidden="true" size={16} /> View receipt
                  </Link>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="customer-orders-empty">
            <ReceiptText aria-hidden="true" size={28} />
            <strong>No receipts found</strong>
            <span>
              {filters.status === "all"
                ? "Payment receipts you submit will appear here."
                : `You do not have any ${filters.status} receipts.`}
            </span>
            {filters.status === "all" && (
              <Link className="customer-orders-next" href="/orders">
                Open an order <ArrowRight aria-hidden="true" size={16} />
              </Link>
            )}
          </div>
        )}

        {result.total > pageSize && (
          <div className="customer-orders-pagination">
            <span>
              Showing {filters.offset + 1}–
              {Math.min(filters.offset + pageSize, result.total)} of {result.total}
            </span>
            <div>
              {filters.offset > 0 && (
                <Link
                  className="customer-orders-back"
                  href={pageHref(Math.max(0, filters.offset - pageSize))}
                >
                  <ArrowLeft aria-hidden="true" size={15} /> Previous
                </Link>
              )}
              {filters.offset + pageSize < result.total && (
                <Link
                  className="customer-orders-next"
                  href={pageHref(filters.offset + pageSize)}
                >
                  Next <ArrowRight aria-hidden="true" size={15} />
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
