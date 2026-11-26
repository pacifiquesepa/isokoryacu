import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowDownToLine, Wallet } from "lucide-react";
import MerchantFinanceActions from "@/components/merchant/finance-actions";
import {
  requireMerchantPageUser,
  requireMerchantWorkspacePermission,
} from "@/lib/authorization";
import { getMerchantFinanceData } from "@/lib/data-access/merchant-finance";

export const metadata: Metadata = {
  title: "Earnings and payouts | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function MerchantFinancePage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading your finance overview…</div>}>
      <MerchantFinanceContent />
    </Suspense>
  );
}

async function MerchantFinanceContent() {
  await requireMerchantWorkspacePermission("canManageFinancialProfile");
  await connection();
  const merchant = await requireMerchantPageUser();
  const finance = await getMerchantFinanceData(merchant);
  const cards = [
    { label: "Eligible earnings", amount: finance.balance.earned, tone: "blue" },
    { label: "Available balance", amount: finance.balance.available, tone: "green" },
    { label: "Payouts reserved", amount: finance.balance.reserved, tone: "yellow" },
    { label: "Payouts paid", amount: finance.balance.paid, tone: "purple" },
  ];

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Finance</div>
          <h1>Earnings and payouts</h1>
          <p>Eligible earnings require a fulfilled order and verified payment.</p>
        </div>
        <Link className="merchant-primary-action" href="#payouts">
          <ArrowDownToLine size={17} /> Request payout
        </Link>
      </div>

      <section aria-label="Merchant finance summary" className="merchant-metrics">
        {cards.map((card) => (
          <article className={`merchant-metric-card is-${card.tone}`} key={card.label}>
            <span className="merchant-metric-top">{card.label}</span>
            <strong>{numberFormat.format(card.amount)} RWF</strong>
            <small>Based on your item subtotal</small>
          </article>
        ))}
      </section>

      <div className="merchant-info-banner" role="note">
        <Wallet size={17} />
        Platform commission is added to the customer-facing price. Earnings below use your original listed prices.
        Orders with a completed refund are excluded from payout eligibility.
      </div>

      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div>
            <h2>Payout account</h2>
            <p>Account details are masked in the merchant workspace.</p>
          </div>
          {finance.profile && (
            <span className={`merchant-status ${finance.profile.isVerified ? "is-fulfilled" : "is-pending"}`}>
              {finance.profile.isVerified ? "Verified" : "Not verified"}
            </span>
          )}
        </div>
        {finance.profile ? (
          <div className="merchant-finance-account-list">
            <div>
              <span>Account holder</span>
              <strong>{finance.profile.accountName}</strong>
            </div>
            <div>
              <span>Currency</span>
              <strong>{finance.profile.currency}</strong>
            </div>
            {finance.profile.destinations.map((destination) => (
              <div key={destination.type}>
                <span>{destination.type === "bank" ? "Bank" : "Mobile money"}</span>
                <strong>{destination.provider} · {destination.maskedNumber}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="merchant-empty-state">No payout account is on file. Submit an account change request for admin verification.</p>
        )}
      </section>

      <div id="payouts">
        <MerchantFinanceActions
          availableBalance={finance.balance.available}
          destinations={finance.profile?.destinations ?? []}
          hasPendingChange={Boolean(finance.pendingChange)}
          isVerified={Boolean(finance.profile?.isVerified)}
        />
      </div>

      <section className="merchant-panel merchant-dashboard-section" id="payout-history">
        <div className="merchant-panel-heading">
          <div>
            <h2>Payout history</h2>
            <p>Requests are processed manually by an administrator.</p>
          </div>
        </div>
        {finance.payouts.length ? (
          <div className="merchant-table-wrap is-polished-table is-finance-table">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Requested</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reference / note</th>
                </tr>
              </thead>
              <tbody>
                {finance.payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>{dateFormat.format(payout.requestedAt)}</td>
                    <td>{numberFormat.format(payout.amount)} {payout.currency}</td>
                    <td>{payout.destinationProvider} · {payout.destinationNumber}</td>
                    <td><span className={`merchant-status is-${payout.status}`}>{payout.status}</span></td>
                    <td>{payout.transactionReference ?? payout.reviewNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><strong>No payout requests</strong><span>Your payout history will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
