"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OrderNotificationRetryAction({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/super-admin/order-notifications/${encodeURIComponent(id)}/retry`,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "Notification could not be retried.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Notification could not be retried.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button disabled={busy} onClick={retry} type="button">
        {busy ? "Retrying…" : "Retry"}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
