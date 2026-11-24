"use client";

import { signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";

type PasswordUpdateResponse = {
  error?: string;
  details?: { fieldErrors?: Record<string, string[]> };
};

export default function CustomerPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");

    const formData = new FormData(form);
    const body = {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    let passwordUpdated = false;
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as
        | PasswordUpdateResponse
        | null;

      if (!response.ok) {
        const detail = Object.values(result?.details?.fieldErrors ?? {})
          .flat()
          .find(Boolean);
        throw new Error(detail || result?.error || "Password could not be updated.");
      }

      passwordUpdated = true;
      await signOut({ callbackUrl: "/login?passwordChanged=1" });
    } catch (caught) {
      console.error(
        passwordUpdated
          ? "Password changed but the customer session could not be ended"
          : "Could not update customer password",
        caught,
      );
      setError(
        passwordUpdated
          ? "Password updated. Sign out and sign in again to continue."
          : caught instanceof Error
            ? caught.message
            : "Password could not be updated.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="customer-account-form" onSubmit={handleSubmit}>
      <div className="customer-account-form-grid">
        <label>
          Current password
          <input
            autoComplete="current-password"
            maxLength={72}
            name="currentPassword"
            required
            type="password"
          />
        </label>
        <label>
          New password
          <input
            autoComplete="new-password"
            maxLength={72}
            minLength={12}
            name="newPassword"
            required
            type="password"
          />
        </label>
        <label>
          Confirm new password
          <input
            autoComplete="new-password"
            maxLength={72}
            minLength={12}
            name="confirmPassword"
            required
            type="password"
          />
        </label>
      </div>
      <div className="customer-account-form-footer">
        <p aria-live="polite" className={error ? "is-error" : ""}>
          {error}
        </p>
        <button disabled={busy} type="submit">
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
