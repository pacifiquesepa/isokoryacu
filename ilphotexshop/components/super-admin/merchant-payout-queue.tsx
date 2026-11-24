"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type PayoutRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  destinationName: string;
  destinationType: "bank" | "mobile_money";
  destinationProvider: string;
  destinationNumber: string;
  transactionReference: string | null;
  reviewNote: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  merchant: { id: string; name: string; email: string };
};

function MerchantPayoutQueueRow({ payout }: { payout: PayoutRow }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function process(action: "paid" | "reject") {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const body =
        action === "paid"
          ? {
              action,
              transactionReference: String(data.get("reference") ?? ""),
            }
          : { action, reason: String(data.get("reason") ?? "") };
      const response = await fetch(
        `/api/super-admin/payments/merchant-payouts/${encodeURIComponent(payout.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(result?.error || "Payout could not be processed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payout could not be processed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td><strong>{payout.merchant.name}</strong><span className="super-admin-audit-secondary">{payout.merchant.email}</span></td>
      <td>{payout.amount.toLocaleString("en-RW")} {payout.currency}</td>
      <td>
        <strong>{payout.destinationName}</strong>
        <span className="super-admin-audit-secondary">
          {payout.destinationType === "bank" ? "Bank" : "Mobile money"} · {payout.destinationProvider} · {payout.destinationNumber}
        </span>
      </td>
      <td><span className={`super-admin-status is-${payout.status}`}>{payout.status}</span></td>
      <td>{payout.transactionReference ?? payout.reviewNote ?? "—"}</td>
      <td>
        {payout.status === "requested" ? (
          <form className="super-admin-confirm-actions" ref={formRef}>
            <input aria-label="Payout transaction reference" maxLength={120} minLength={3} name="reference" placeholder="Transaction reference" required />
            <button className="super-admin-primary-action" disabled={busy} onClick={() => void process("paid")} type="button">
              {busy ? "Saving…" : "Mark paid"}
            </button>
            <input aria-label="Payout rejection reason" maxLength={500} minLength={3} name="reason" placeholder="Reason to reject" />
            <button className="super-admin-row-action" disabled={busy} onClick={() => void process("reject")} type="button">
              Reject
            </button>
            {error && <span className="super-admin-row-action-error" role="alert">{error}</span>}
          </form>
        ) : "Processed"}
      </td>
    </tr>
  );
}

export default function MerchantPayoutQueue({ rows }: { rows: PayoutRow[] }) {
  if (!rows.length) {
    return <div className="super-admin-records-empty"><strong>No payout requests</strong><span>Merchant payout requests will appear here.</span></div>;
  }
  return (
    <div className="super-admin-records-table-wrap">
      <table className="super-admin-records-table">
        <thead><tr><th>Merchant</th><th>Amount</th><th>Destination snapshot</th><th>Status</th><th>Reference / note</th><th>Action</th></tr></thead>
        <tbody>{rows.map((payout) => <MerchantPayoutQueueRow key={payout.id} payout={payout} />)}</tbody>
      </table>
    </div>
  );
}
