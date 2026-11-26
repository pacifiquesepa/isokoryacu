"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelStaffInvitation({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/seller/staff/invitations/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "Invitation could not be cancelled.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="merchant-table-action is-danger" disabled={busy} onClick={cancel} type="button">
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      {error && <span className="merchant-form-error" role="alert">{error}</span>}
    </>
  );
}
