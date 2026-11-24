"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "fulfilled"
  | "cancelled";

export default function OrderWorkflowActions({
  orderId,
  status,
  paymentMode,
  cashCollected,
}: {
  orderId: string;
  status: string;
  paymentMode?: string;
  cashCollected?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showShipment, setShowShipment] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [cashReference, setCashReference] = useState("");
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: Exclude<OrderStatus, "shipped">) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Order status could not be updated.");
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

  async function markShipped() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/super-admin/orders/${encodeURIComponent(orderId)}/shipment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carrier,
            trackingNumber,
            status: "shipped",
            notes: notes || undefined,
          }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Shipment could not be recorded.");
      }

      setShowShipment(false);
      setCarrier("");
      setTrackingNumber("");
      setNotes("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Shipment could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function markCashCollected() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/cash-collection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: cashReference.trim() || undefined,
          }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Cash collection could not be recorded.");
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Cash collection could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="super-admin-order-workflow">
      {status === "pending" && (
        confirmCancel ? (
          <span className="super-admin-confirm-actions">
            <button
              className="super-admin-row-action is-danger"
              disabled={busy}
              onClick={() => updateStatus("cancelled")}
              type="button"
            >
              Confirm cancellation
            </button>
            <button
              className="super-admin-row-action is-muted"
              disabled={busy}
              onClick={() => setConfirmCancel(false)}
              type="button"
            >
              Keep order
            </button>
          </span>
        ) : (
          <span className="super-admin-confirm-actions">
            <button
              className="super-admin-row-action"
              disabled={busy}
              onClick={() => updateStatus("confirmed")}
              type="button"
            >
              Confirm order
            </button>
            <button
              className="super-admin-row-action is-danger"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
              type="button"
            >
              Cancel order
            </button>
          </span>
        )
      )}
      {status === "confirmed" && (
        <button
          className="super-admin-row-action"
          disabled={busy}
          onClick={() => updateStatus("processing")}
          type="button"
        >
          Start processing
        </button>
      )}
      {status === "processing" && (
        showShipment ? (
          <span className="super-admin-shipment-form">
            <label>
              Carrier
              <input
                maxLength={160}
                onChange={(event) => setCarrier(event.target.value)}
                value={carrier}
              />
            </label>
            <label>
              Tracking number
              <input
                maxLength={160}
                onChange={(event) => setTrackingNumber(event.target.value)}
                value={trackingNumber}
              />
            </label>
            <label>
              Notes
              <textarea
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                value={notes}
              />
            </label>
            <span className="super-admin-confirm-actions">
              <button
                className="super-admin-row-action"
                disabled={
                  busy ||
                  carrier.trim().length < 2 ||
                  trackingNumber.trim().length < 2
                }
                onClick={markShipped}
                type="button"
              >
                Record shipment
              </button>
              <button
                className="super-admin-row-action is-muted"
                disabled={busy}
                onClick={() => setShowShipment(false)}
                type="button"
              >
                Cancel
              </button>
            </span>
          </span>
        ) : (
          <button
            className="super-admin-row-action"
            disabled={busy}
            onClick={() => setShowShipment(true)}
            type="button"
          >
            Mark shipped
          </button>
        )
      )}
      {status === "shipped" && (
        <button
          className="super-admin-row-action"
          disabled={busy}
          onClick={() => updateStatus("delivered")}
          type="button"
        >
          Mark delivered
        </button>
      )}
      {paymentMode === "cash_on_delivery" && cashCollected && (
        <span className="super-admin-role-confirm-note">
          Cash collection confirmed by an administrator.
        </span>
      )}
      {paymentMode === "cash_on_delivery" &&
        !cashCollected &&
        status !== "cancelled" && (
          <span className="super-admin-confirm-actions">
            <input
              aria-label="Cash collection reference"
              maxLength={120}
              minLength={3}
              onChange={(event) => setCashReference(event.target.value)}
              placeholder="Collection reference (optional)"
              value={cashReference}
            />
            <button
              className="super-admin-row-action"
              disabled={busy}
              onClick={markCashCollected}
              type="button"
            >
              Confirm cash collected
            </button>
          </span>
        )}
      {status === "delivered" && (
        <button
          className="super-admin-row-action"
          disabled={busy}
          onClick={() => updateStatus("fulfilled")}
          type="button"
        >
          Mark fulfilled
        </button>
      )}
      {(status === "fulfilled" || status === "cancelled") && (
        <span className="super-admin-role-confirm-note">
          This order is at a terminal status.
        </span>
      )}
      {error && (
        <span aria-live="polite" className="super-admin-row-action-error">
          {error}
        </span>
      )}
    </div>
  );
}
