import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import SuperAdminPaymentProofReviewActions from "@/components/super-admin/payment-proof-review-actions";
import {
  getSuperAdminPaymentProofQueue,
  type PaymentProofQueueStatus,
} from "@/lib/data-access/order-payment-proofs";

export const metadata: Metadata = {
  title: "Payment Proofs | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const pageSize = 50;
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function SuperAdminPaymentProofsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading payment proofs…</div>}>
      <PaymentProofsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PaymentProofsContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status: PaymentProofQueueStatus =
    params.status === "pending" || params.status === "approved" || params.status === "rejected"
      ? params.status
      : "all";
  const requestedPage = Number(params.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;
  const queue = await getSuperAdminPaymentProofQueue(
    status,
    (page - 1) * pageSize,
  );
  const pageCount = Math.max(1, Math.ceil(queue.total / pageSize));
  if (page > pageCount) {
    redirect(
      `/super-admin/payments/payment-proofs?status=${status}&page=${pageCount}`,
    );
  }
  const filters: { label: string; value: PaymentProofQueueStatus }[] = [
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">
            Workspace / Payment Management / Payment Proofs
          </div>
          <h1>Payment proof review</h1>
          <p>Review customer receipts. Approval does not automatically confirm an order.</p>
        </div>
        <CreditCard aria-hidden="true" size={25} />
      </div>

      <div className="super-admin-data-note" role="note">
        Verify the receipt and transaction against the destination account before approving.
        Refund handling is not available; orders with approved proofs cannot be cancelled.
      </div>

      <section aria-label="Payment proof summary" className="super-admin-records-summary">
        {[
          ["Pending review", queue.pending],
          ["Approved", queue.approved],
          ["Rejected", queue.rejected],
        ].map(([label, count]) => (
          <article className="super-admin-summary-card" key={label}>
            <span>{label}</span>
            <strong>{Number(count).toLocaleString("en-RW")}</strong>
          </article>
        ))}
      </section>

      <section className="super-admin-panel super-admin-audit-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Submitted receipts</h2>
            <p>{queue.total.toLocaleString("en-RW")} matching records</p>
          </div>
        </div>
        <nav aria-label="Payment proof status filter" className="super-admin-payment-proof-filters">
          {filters.map((filter) => (
            <Link
              aria-current={status === filter.value ? "page" : undefined}
              className={status === filter.value ? "is-active" : ""}
              href={`/super-admin/payments/payment-proofs?status=${filter.value}`}
              key={filter.value}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
        {queue.rows.length ? (
          <>
            <div className="super-admin-records-table-wrap">
              <table className="super-admin-records-table">
                <thead>
                  <tr>
                    <th scope="col">Customer / Order</th>
                    <th scope="col">Method / Reference</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Receipt</th>
                    <th scope="col">Status / Submitted</th>
                    <th scope="col">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.rows.map((proof) => (
                    <tr key={proof.id}>
                      <td>
                        <strong>{proof.customer.name || proof.customer.email}</strong>
                        <br />
                        <span>{proof.customer.email}</span>
                        <br />
                        <code>{proof.order.id}</code>
                      </td>
                      <td>
                        {proof.method === "bank_transfer" ? "Bank transfer" : "Mobile money"}
                        <br />
                        <code>{proof.transactionReference}</code>
                      </td>
                      <td>{proof.amount.toLocaleString("en-RW")} {proof.currency}</td>
                      <td>
                        <Link
                          href={`/api/super-admin/payments/payment-proofs/${encodeURIComponent(proof.id)}/document`}
                        >
                          {proof.documentName}
                        </Link>
                      </td>
                      <td>
                        <span className={`super-admin-merchant-access-status${proof.status === "pending" ? "" : " is-suspended"}`}>
                          {proof.status}
                        </span>
                        <br />
                        {dateFormat.format(proof.createdAt)} UTC
                        {proof.reviewReason && <p>{proof.reviewReason}</p>}
                      </td>
                      <td>
                        {proof.status === "pending" ? (
                          <SuperAdminPaymentProofReviewActions id={proof.id} />
                        ) : (
                          <span>
                            Order: {proof.order.status}
                            <br />
                            Receipt amount: {(proof.order.subtotal + proof.order.deliveryFee).toLocaleString("en-RW")} {proof.order.currency}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="super-admin-payment-proof-pagination">
              <span>Page {page} of {pageCount}</span>
              <div>
                {page > 1 && (
                  <Link href={`/super-admin/payments/payment-proofs?status=${status}&page=${page - 1}`}>
                    Previous
                  </Link>
                )}
                {page < pageCount && (
                  <Link href={`/super-admin/payments/payment-proofs?status=${status}&page=${page + 1}`}>
                    Next
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="super-admin-records-empty">
            <CreditCard aria-hidden="true" size={25} />
            <strong>No payment proofs found</strong>
            <span>There are no submissions matching this status.</span>
          </div>
        )}
      </section>
    </div>
  );
}
