"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function CreateMerchantSupportTicket() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/seller/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: String(formData.get("subject") ?? ""),
          description: String(formData.get("description") ?? ""),
          category: String(formData.get("category") ?? ""),
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Support ticket could not be created.");
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Support ticket could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="merchant-form-grid" onSubmit={submit}>
      <label>Subject<input name="subject" maxLength={200} minLength={3} required /></label>
      <label>Category<select name="category" defaultValue="General"><option>General</option><option>Order</option><option>Payment</option><option>Product</option><option>Merchant</option><option>Account</option></select></label>
      <label>Description<textarea name="description" maxLength={4000} minLength={3} required rows={4} /></label>
      <button className="merchant-primary-action" disabled={busy} type="submit">{busy ? "Submitting…" : "Create support ticket"}</button>
      {error && <p className="merchant-form-error" role="alert">{error}</p>}
    </form>
  );
}
