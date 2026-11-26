"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MerchantOrderStatus = "confirmed" | "processing" | "cancelled";

export default function MerchantOrderWorkflowActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: MerchantOrderStatus) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/seller/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "Order status could not be updated.");
      }
      setConfirmCancel(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Order status could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="merchant-order-actions">
      {status === "pending" &&
        (confirmCancel ? (
          <>
            <button
              className="merchant-table-action is-danger"
              disabled={busy}
              onClick={() => updateStatus("cancelled")}
              type="button"
            >
              Confirm cancellation
            </button>
            <button
              className="merchant-table-action"
              disabled={busy}
              onClick={() => setConfirmCancel(false)}
              type="button"
            >
              Keep order
            </button>
          </>
        ) : (
          <>
            <button
              className="merchant-table-action"
              disabled={busy}
              onClick={() => updateStatus("confirmed")}
              type="button"
            >
              Confirm order
            </button>
            <button
              className="merchant-table-action is-danger"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
              type="button"
            >
              Cancel
            </button>
          </>
        ))}
      {status === "confirmed" && (
        <button
          className="merchant-table-action"
          disabled={busy}
          onClick={() => updateStatus("processing")}
          type="button"
        >
          Start processing
        </button>
      )}
      {status === "processing" && (
        <span className="merchant-list-note">
          Shipment and final delivery are handled centrally.
        </span>
      )}
      {(status === "shipped" ||
        status === "delivered" ||
        status === "fulfilled" ||
        status === "cancelled") && (
        <span className="merchant-list-note">No action available</span>
      )}
      {error && (
        <span className="merchant-form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
