import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Download } from "lucide-react";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import { requireCustomerPageUser } from "@/lib/authorization";
import { getCustomerPaymentProof } from "@/lib/data-access/order-payment-proofs";
import { paymentProofIdSchema } from "@/lib/validation/payment-proofs";

export const metadata: Metadata = {
  title: "Payment receipt | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const amountFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function CustomerPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <CustomerPortalLayout active="payments">
      <Suspense
        fallback={
          <div className="customer-orders-loading">Loading payment receipt…</div>
        }
      >
        <CustomerPaymentDetailContent params={params} />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function CustomerPaymentDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const parsedId = paymentProofIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const customer = await requireCustomerPageUser(
    `/account/payments/${encodeURIComponent(id)}`,
  );
  const proof = await getCustomerPaymentProof(customer.id, parsedId.data);
  if (!proof) notFound();

  const receiptTitle = `Payment receipt ${proof.id.slice(-8).toUpperCase()}`;
  const method =
    proof.method === "bank_transfer" ? "Bank transfer" : "Mobile money";
  const fields = [
    { label: "Receipt ID", value: proof.id },
    { label: "Order ID", value: proof.order.id },
    { label: "Receipt status", value: proof.status },
    { label: "Payment method", value: method },
    {
      label: "Amount submitted",
      value: `${amountFormat.format(proof.amount)} ${proof.currency}`,
    },
    { label: "Transaction reference", value: proof.transactionReference },
    { label: "Uploaded receipt file", value: proof.documentName },
    { label: "Submitted", value: `${dateFormat.format(proof.createdAt)} UTC` },
    ...(proof.reviewedAt
      ? [{ label: "Reviewed", value: `${dateFormat.format(proof.reviewedAt)} UTC` }]
      : []),
    ...(proof.reviewReason
      ? [{ label: "Review note", value: proof.reviewReason }]
      : []),
    { label: "Order status", value: proof.order.status },
    { label: "Order placed", value: `${dateFormat.format(proof.order.createdAt)} UTC` },
    {
      label: "Order total",
      value: `${amountFormat.format(proof.order.subtotal + proof.order.deliveryFee)} ${proof.order.currency}`,
    },
  ];

  return (
    <div className="customer-orders-page customer-payment-detail-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">
            <Link href="/account/payments">Payments &amp; receipts</Link> / Receipt
          </span>
          <h1>{receiptTitle}</h1>
          <p>Receipt details and the order it belongs to.</p>
        </div>
        <Link className="customer-orders-back" href="/account/payments">
          <ArrowLeft aria-hidden="true" size={16} /> Back to payments
        </Link>
      </div>

      <article className="customer-order-record customer-payment-record">
        <header className="customer-order-brand">
          <Image
            alt=""
            height={44}
            src="/ilphotox-shop-logo.png"
            width={44}
          />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Payment receipt · Customer record</span>
          </div>
          <span className={`customer-payment-proof-status is-${proof.status}`}>
            {proof.status}
          </span>
        </header>

        <section className="customer-payment-record-content">
          <div className="customer-payment-record-amount">
            <span>Submitted amount</span>
            <strong>
              {amountFormat.format(proof.amount)} {proof.currency}
            </strong>
            <small>
              This receipt is {proof.status}; it does not by itself confirm an
              order.
            </small>
          </div>

          <dl className="customer-payment-record-details">
            <div>
              <dt>Payment method</dt>
              <dd>{method}</dd>
            </div>
            <div>
              <dt>Transaction reference</dt>
              <dd>{proof.transactionReference}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{dateFormat.format(proof.createdAt)} UTC</dd>
            </div>
            <div>
              <dt>Uploaded receipt</dt>
              <dd>{proof.documentName}</dd>
            </div>
            {proof.reviewedAt && (
              <div>
                <dt>Reviewed</dt>
                <dd>{dateFormat.format(proof.reviewedAt)} UTC</dd>
              </div>
            )}
            {proof.reviewReason && (
              <div className="customer-payment-record-review-note">
                <dt>Review note</dt>
                <dd>{proof.reviewReason}</dd>
              </div>
            )}
            <div>
              <dt>Related order</dt>
              <dd>
                #{proof.order.id.slice(-8).toUpperCase()} · {proof.order.status}
              </dd>
            </div>
            <div>
              <dt>Order placed</dt>
              <dd>{dateFormat.format(proof.order.createdAt)} UTC</dd>
            </div>
            <div>
              <dt>Order total</dt>
              <dd>
                {amountFormat.format(proof.order.subtotal + proof.order.deliveryFee)}{" "}
                {proof.order.currency}
              </dd>
            </div>
          </dl>

          <div className="customer-payment-record-actions">
            <a
              className="customer-payment-download"
              href={`/api/orders/${encodeURIComponent(proof.order.id)}/payment-proofs/${encodeURIComponent(proof.id)}/document`}
            >
              <Download aria-hidden="true" size={16} />
              Download submitted receipt
            </a>
            <Link
              className="customer-payment-order-link"
              href={`/orders/${encodeURIComponent(proof.order.id)}`}
            >
              View related order
            </Link>
          </div>
        </section>

        <section className="customer-order-export">
          <div className="customer-order-section-heading">
            <div>
              <h2>Save or share this record</h2>
              <p>Download or share a protected PDF with a QR code.</p>
            </div>
          </div>
          <SuperAdminRecordActions
            fields={fields}
            recordId={proof.id}
            title={receiptTitle}
          />
        </section>
      </article>
    </div>
  );
}
