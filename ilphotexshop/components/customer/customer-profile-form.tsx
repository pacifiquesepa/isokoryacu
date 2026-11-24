"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CustomerProfileFormProps = {
  name: string;
  phone: string | null;
};

type ProfileUpdateResponse = {
  error?: string;
  details?: { fieldErrors?: Record<string, string[]> };
};

export default function CustomerProfileForm({
  name,
  phone,
}: CustomerProfileFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");

    const formData = new FormData(form);
    const body = {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as
        | ProfileUpdateResponse
        | null;

      if (!response.ok) {
        const detail = Object.values(result?.details?.fieldErrors ?? {})
          .flat()
          .find(Boolean);
        throw new Error(detail || result?.error || "Profile could not be updated.");
      }

      setNotice("Profile updated.");
      router.refresh();
    } catch (caught) {
      console.error("Could not update customer profile", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Profile could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="customer-account-form" onSubmit={handleSubmit}>
      <div className="customer-account-form-grid">
        <label>
          Full name
          <input
            autoComplete="name"
            defaultValue={name}
            maxLength={100}
            minLength={2}
            name="name"
            required
          />
        </label>
        <label>
          Phone number
          <input
            autoComplete="tel"
            defaultValue={phone ?? ""}
            maxLength={32}
            name="phone"
            pattern="^\+?[0-9][0-9 ()-]*$"
            type="tel"
          />
        </label>
      </div>
      <div className="customer-account-form-footer">
        <div aria-live="polite">
          {error && <p className="is-error">{error}</p>}
          {notice && <p className="is-success">{notice}</p>}
        </div>
        <button disabled={busy} type="submit">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
