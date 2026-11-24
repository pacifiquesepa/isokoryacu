import { Suspense } from "react";
import type { Metadata } from "next";
import { WalletCards } from "lucide-react";
import MerchantPayoutQueue from "@/components/super-admin/merchant-payout-queue";
import { getSuperAdminMerchantPayouts } from "@/lib/data-access/merchant-finance";

export const metadata: Metadata = {
  title: "Merchant payouts | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default function MerchantPayoutsPage() {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading payout requests…</div>}>
      <MerchantPayoutsContent />
    </Suspense>
  );
}

async function MerchantPayoutsContent() {
  const rows = await getSuperAdminMerchantPayouts();
  const pending = rows.filter((row) => row.status === "requested").length;
  const paid = rows.filter((row) => row.status === "paid").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / Payment Management / Merchant Payouts</div>
          <h1>Merchant payouts</h1>
          <p>Review payout requests and record manually completed transfers.</p>
        </div>
        <WalletCards aria-hidden="true" size={25} />
      </div>
      <p className="super-admin-data-note" role="note">
        Mark a payout as paid only after the transfer is complete and include its transaction reference.
        Requested payouts reserve the merchant&apos;s available balance.
      </p>
      <section aria-label="Payout request summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card is-pending"><span>Awaiting processing</span><strong>{pending.toLocaleString("en-RW")}</strong></article>
        <article className="super-admin-summary-card is-active"><span>Paid</span><strong>{paid.toLocaleString("en-RW")}</strong></article>
        <article className="super-admin-summary-card"><span>Rejected</span><strong>{rejected.toLocaleString("en-RW")}</strong></article>
      </section>
      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar">
          <div><h2>Payout requests</h2><p>{rows.length.toLocaleString("en-RW")} recent records</p></div>
        </div>
        <MerchantPayoutQueue rows={rows} />
      </section>
    </div>
  );
}
