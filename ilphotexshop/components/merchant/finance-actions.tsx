"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Destination = {
  type: "bank" | "mobile_money";
  provider: string;
  maskedNumber: string;
};

export default function MerchantFinanceActions({
  availableBalance,
  destinations,
  isVerified,
  hasPendingChange,
}: {
  availableBalance: number;
  destinations: Destination[];
  isVerified: boolean;
  hasPendingChange: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    transform: (form: FormData) => object,
    successMessage: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transform(new FormData(form))),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(result?.error || "Request could not be submitted.");
      form.reset();
      setNotice(successMessage);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="merchant-finance-action-grid">
      <section className="merchant-panel">
        <div className="merchant-panel-heading">
          <div>
            <h2>Request a payout</h2>
            <p>Only fulfilled and payment-verified orders are available.</p>
          </div>
        </div>
        <form
          className="merchant-form-grid"
          onSubmit={(event) =>
            void submit(
              event,
              "/api/seller/finance/payouts",
              (form) => ({
                amount: Number(form.get("amount")),
                destinationType: String(form.get("destinationType")),
              }),
              "Payout request submitted for admin processing.",
            )
          }
        >
          <label>
            Amount (RWF)
            <input
              max={availableBalance}
              min={1}
              name="amount"
              required
              type="number"
            />
          </label>
          <label>
            Payout destination
            <select
              disabled={!isVerified || destinations.length === 0}
              name="destinationType"
              required
            >
              {destinations.map((destination) => (
                <option key={destination.type} value={destination.type}>
                  {destination.provider} · {destination.maskedNumber}
                </option>
              ))}
            </select>
          </label>
          <div className="merchant-form-actions">
            <button
              className="merchant-primary-action"
              disabled={busy || !isVerified || !availableBalance || !destinations.length}
              type="submit"
            >
              {busy ? "Submitting…" : "Request payout"}
            </button>
            {!isVerified && <small>A verified payout account is required.</small>}
          </div>
        </form>
        {error && <p className="merchant-form-error" role="alert">{error}</p>}
        {notice && <p className="merchant-form-success" role="status">{notice}</p>}
      </section>

      <section className="merchant-panel">
        <div className="merchant-panel-heading">
          <div>
            <h2>Request payout account change</h2>
            <p>Super admin reviews changes before a destination can be used.</p>
          </div>
        </div>
        {hasPendingChange ? (
          <p className="merchant-info-banner" role="status">
            Your account change is awaiting admin review.
          </p>
        ) : (
          <form
            className="merchant-form-grid"
            onSubmit={(event) =>
              void submit(
                event,
                "/api/seller/finance/payout-account",
                (form) => ({
                  accountName: String(form.get("accountName") ?? ""),
                  bankName: String(form.get("bankName") ?? ""),
                  bankAccountNumber: String(form.get("bankAccountNumber") ?? ""),
                  mobileMoneyProvider: String(form.get("mobileMoneyProvider") ?? ""),
                  mobileMoneyNumber: String(form.get("mobileMoneyNumber") ?? ""),
                }),
                "Payout account change submitted for verification.",
              )
            }
          >
            <label>
              Account holder name
              <input autoComplete="name" maxLength={160} minLength={2} name="accountName" required />
            </label>
            <label>
              Bank name (optional)
              <input maxLength={160} name="bankName" />
            </label>
            <label>
              Bank account number
              <input maxLength={100} name="bankAccountNumber" />
            </label>
            <label>
              Mobile money provider (optional)
              <input maxLength={100} name="mobileMoneyProvider" />
            </label>
            <label>
              Mobile money number
              <input autoComplete="tel" maxLength={32} name="mobileMoneyNumber" />
            </label>
            <div className="merchant-form-actions">
              <button className="merchant-secondary-action" disabled={busy} type="submit">
                {busy ? "Submitting…" : "Submit account change"}
              </button>
            </div>
          </form>
        )}
        {error && <p className="merchant-form-error" role="alert">{error}</p>}
        {notice && <p className="merchant-form-success" role="status">{notice}</p>}
      </section>
    </div>
  );
}
