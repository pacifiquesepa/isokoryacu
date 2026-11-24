"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type FinancialChangeRow = {
  id: string;
  accountName: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  currency: string;
  status: string;
  reviewNote: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  merchant: { id: string; name: string; email: string };
};

function FinancialChangeRowView({ row }: { row: FinancialChangeRow }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review(action: "approve" | "reject") {
    const form = formRef.current;
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        action,
        reason: String(new FormData(form).get("reason") ?? ""),
      };
      const response = await fetch(
        `/api/super-admin/merchants/financial-change-requests/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(result?.error || "Account change could not be reviewed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account change could not be reviewed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td><strong>{row.merchant.name}</strong><span className="super-admin-audit-secondary">{row.merchant.email}</span></td>
      <td><strong>{row.accountName}</strong><span className="super-admin-audit-secondary">{row.currency}</span></td>
      <td>{row.bankName ? <><strong>{row.bankName}</strong><span className="super-admin-audit-secondary">{row.bankAccountNumber}</span></> : "Not provided"}</td>
      <td>{row.mobileMoneyProvider ? <><strong>{row.mobileMoneyProvider}</strong><span className="super-admin-audit-secondary">{row.mobileMoneyNumber}</span></> : "Not provided"}</td>
      <td>{new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeZone: "UTC" }).format(row.requestedAt)}</td>
      <td>
        {row.status === "pending" ? (
          <form className="super-admin-confirm-actions" ref={formRef}>
            <input aria-label="Rejection reason" maxLength={500} minLength={3} name="reason" placeholder="Reason to reject" />
            <button className="super-admin-primary-action" disabled={busy} onClick={() => void review("approve")} type="button">
              {busy ? "Saving…" : "Approve and verify"}
            </button>
            <button className="super-admin-row-action" disabled={busy} onClick={() => void review("reject")} type="button">
              Reject
            </button>
            {error && <span className="super-admin-row-action-error" role="alert">{error}</span>}
          </form>
        ) : <span className={`super-admin-status is-${row.status}`}>{row.status}{row.reviewNote ? ` · ${row.reviewNote}` : ""}</span>}
      </td>
    </tr>
  );
}

export default function FinancialChangeQueue({
  rows,
}: {
  rows: FinancialChangeRow[];
}) {
  if (!rows.length) {
    return <div className="super-admin-records-empty"><strong>No account change requests</strong><span>Merchant requests will appear here.</span></div>;
  }
  return (
    <div className="super-admin-records-table-wrap">
      <table className="super-admin-records-table">
        <thead><tr><th>Merchant</th><th>Account holder</th><th>Bank</th><th>Mobile money</th><th>Requested</th><th>Review</th></tr></thead>
        <tbody>{rows.map((row) => <FinancialChangeRowView key={row.id} row={row} />)}</tbody>
      </table>
    </div>
  );
}
