import { Suspense } from "react";
import type { Metadata } from "next";
import { WalletCards } from "lucide-react";
import FinancialChangeQueue from "@/components/super-admin/financial-change-queue";
import { getSuperAdminFinancialChangeRequests } from "@/lib/data-access/merchant-finance";

export const metadata: Metadata = {
  title: "Payout account change requests | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default function FinancialChangeRequestsPage() {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading account change requests…</div>}>
      <FinancialChangeRequestsContent />
    </Suspense>
  );
}

async function FinancialChangeRequestsContent() {
  const rows = await getSuperAdminFinancialChangeRequests();
  const pending = rows.filter((row) => row.status === "pending").length;
  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / Merchant Management / Payout account requests</div>
          <h1>Payout account change requests</h1>
          <p>Verify merchant-submitted payout destinations before use.</p>
        </div>
        <WalletCards aria-hidden="true" size={25} />
      </div>
      <p className="super-admin-data-note" role="note">
        Approval replaces the merchant&apos;s payout profile and marks the new destination as verified.
        The payout itself is still processed manually from Payment Management.
      </p>
      <section aria-label="Account change request summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card is-pending"><span>Awaiting review</span><strong>{pending.toLocaleString("en-RW")}</strong></article>
        <article className="super-admin-summary-card"><span>Recent records</span><strong>{rows.length.toLocaleString("en-RW")}</strong></article>
      </section>
      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar">
          <div><h2>Submitted payout destinations</h2><p>{rows.length.toLocaleString("en-RW")} recent records</p></div>
        </div>
        <FinancialChangeQueue rows={rows} />
      </section>
    </div>
  );
}
