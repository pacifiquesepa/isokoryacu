import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CreditCard } from "lucide-react";
import { getSuperAdminPaymentOverview } from "@/lib/data-access/order-payment-proofs";

export const metadata: Metadata = {
  title: "Payment Overview | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const numberFormat = new Intl.NumberFormat("en-RW");
const methodLabels = {
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
};

export default async function SuperAdminPaymentOverviewPage() {
  const overview = await getSuperAdminPaymentOverview();
  const cards = [
    { label: "Receipt submissions", value: overview.totalProofs },
    { label: "Awaiting review", value: overview.pendingProofs },
    { label: "Approved proofs", value: overview.approvedProofs },
    { label: "Rejected proofs", value: overview.rejectedProofs },
  ];

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">
            Workspace / Payment Management / Payment Overview
          </div>
          <h1>Payment overview</h1>
          <p>Receipt review activity recorded by the marketplace.</p>
        </div>
        <CreditCard aria-hidden="true" size={25} />
      </div>

      <div className="super-admin-data-note" role="note">
        These figures describe uploaded receipt proofs, not gateway transactions or settled revenue.
        Payout requests are processed manually in{" "}
        <Link href="/super-admin/payments/merchant-payouts">merchant payouts</Link>.
      </div>

      <section aria-label="Payment proof summary" className="super-admin-records-summary">
        {cards.map((card) => (
          <article className="super-admin-summary-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{numberFormat.format(card.value)}</strong>
          </article>
        ))}
      </section>

      <div className="super-admin-payment-overview-grid">
        <section className="super-admin-panel">
          <div className="super-admin-panel-heading">
            <div>
              <h2>Approved receipt amounts</h2>
              <p>Amounts from manually approved proofs, grouped by currency</p>
            </div>
          </div>
          {overview.approvedAmounts.length ? (
            <div className="super-admin-payment-overview-list">
              {overview.approvedAmounts.map((entry) => (
                <div key={entry.currency}>
                  <span>{entry.currency}</span>
                  <strong>{numberFormat.format(entry.amount)}</strong>
                  <small>sum of approved receipt amounts</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="super-admin-records-empty">
              <CreditCard aria-hidden="true" size={24} />
              <strong>No approved receipts</strong>
              <span>Approved receipt amounts will appear here.</span>
            </div>
          )}
        </section>

        <section className="super-admin-panel">
          <div className="super-admin-panel-heading">
            <div>
              <h2>Submitted payment methods</h2>
              <p>Receipt submissions grouped by selected method</p>
            </div>
          </div>
          {overview.methods.length ? (
            <div className="super-admin-payment-overview-list">
              {overview.methods.map((entry) => (
                <div key={entry.method}>
                  <span>{methodLabels[entry.method]}</span>
                  <strong>{numberFormat.format(entry.count)}</strong>
                  <small>receipt submissions</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="super-admin-records-empty">
              <CreditCard aria-hidden="true" size={24} />
              <strong>No receipt submissions</strong>
              <span>Method totals will appear after customers submit receipts.</span>
            </div>
          )}
        </section>
      </div>

      <div className="super-admin-payment-overview-actions">
        <Link
          className="super-admin-primary-action"
          href="/super-admin/payments/payment-proofs?status=pending"
        >
          Review pending receipts <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
        <Link
          className="super-admin-back-action"
          href="/super-admin/payments/bank-accounts"
        >
          Configure payment accounts
        </Link>
      </div>
    </div>
  );
}
