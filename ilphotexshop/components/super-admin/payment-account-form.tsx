"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SuperAdminPaymentAccountForm({
  type,
}: {
  type: "bank" | "mobile_money";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/super-admin/payments/accounts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          provider: values.get("provider"),
          accountName: values.get("accountName"),
          accountNumber: values.get("accountNumber"),
          currency: values.get("currency"),
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (response.status === 401) {
        throw new Error(
          "Authentication required. Refresh the page and sign in again.",
        );
      }
      if (!response.ok) {
        throw new Error(result?.error || "Payment account could not be saved.");
      }

      form.reset();
      setNotice("Payment account added.");
      router.refresh();
    } catch (caught) {
      console.error("Could not add payment account", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Payment account could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="super-admin-profile-form" onSubmit={handleSubmit}>
      <div className="super-admin-profile-form-grid">
        <div className="super-admin-profile-field">
          <span>Account type</span>
          <strong>{type === "bank" ? "Bank account" : "Mobile money"}</strong>
        </div>
        <div className="super-admin-profile-field">
          <label htmlFor="payment-account-provider">
            {type === "bank" ? "Bank name" : "Mobile-money provider"}
          </label>
          <input
            autoComplete="organization"
            id="payment-account-provider"
            maxLength={100}
            minLength={2}
            name="provider"
            required
          />
        </div>
        <div className="super-admin-profile-field">
          <label htmlFor="payment-account-name">Account name</label>
          <input
            autoComplete="off"
            id="payment-account-name"
            maxLength={160}
            minLength={2}
            name="accountName"
            required
          />
        </div>
        <div className="super-admin-profile-field">
          <label htmlFor="payment-account-number">Account number</label>
          <input
            autoComplete="off"
            id="payment-account-number"
            maxLength={100}
            minLength={3}
            name="accountNumber"
            required
          />
        </div>
        <div className="super-admin-profile-field">
          <label htmlFor="payment-account-currency">Currency</label>
          <input
            autoCapitalize="characters"
            defaultValue="RWF"
            id="payment-account-currency"
            maxLength={3}
            minLength={3}
            name="currency"
            pattern="[A-Z]{3}"
            required
          />
        </div>
      </div>
      <div className="super-admin-profile-form-footer">
        <div aria-live="polite">
          {error && <p className="is-error">{error}</p>}
          {notice && <p className="is-success">{notice}</p>}
        </div>
        <button className="super-admin-primary-action" disabled={busy} type="submit">
          {busy ? "Saving…" : "Add payment account"}
        </button>
      </div>
    </form>
  );
}
