"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function MerchantInventoryAdjustForm({
  productId,
  quantity,
}: {
  productId: string;
  quantity: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/seller/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: Number(data.get("quantity")),
          reason: String(data.get("reason") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(result?.error || "Stock could not be adjusted.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stock could not be adjusted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="merchant-inventory-adjust-form" onSubmit={submit}>
      <label>
        <span className="sr-only">New stock quantity</span>
        <input
          aria-label="New stock quantity"
          defaultValue={quantity}
          max={1_000_000}
          min={0}
          name="quantity"
          required
          type="number"
        />
      </label>
      <label>
        <span className="sr-only">Adjustment reason</span>
        <input
          aria-label="Adjustment reason"
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="Reason"
          required
        />
      </label>
      <button className="merchant-secondary-action" disabled={busy} type="submit">
        {busy ? "Saving…" : "Adjust"}
      </button>
      {error && <span className="merchant-form-error" role="alert">{error}</span>}
    </form>
  );
}
