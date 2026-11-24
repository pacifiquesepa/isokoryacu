"use client";

import { useState, type FormEvent } from "react";

type Settings = {
  deliveryFeeRwf: number;
  etaKigali: string;
  etaOutsideKigali: string;
  etaInternational: string;
};

export default function SuperAdminDeliverySettingsForm({
  settings,
}: {
  settings: Settings;
}) {
  const [values, setValues] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/super-admin/delivery/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as
        | { settings?: Settings; error?: string }
        | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(payload?.error || "Delivery settings could not be saved.");
      }
      setValues(payload.settings);
      setNotice("Delivery settings saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Delivery settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="super-admin-profile-form" onSubmit={save}>
      <label>
        Delivery fee (RWF)
        <input
          min={0}
          max={10_000_000}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              deliveryFeeRwf: Number(event.target.value),
            }))
          }
          required
          type="number"
          value={values.deliveryFeeRwf}
        />
      </label>
      <label>
        Estimate within Kigali
        <input
          maxLength={120}
          minLength={3}
          onChange={(event) =>
            setValues((current) => ({ ...current, etaKigali: event.target.value }))
          }
          required
          value={values.etaKigali}
        />
      </label>
      <label>
        Estimate elsewhere in Rwanda
        <input
          maxLength={120}
          minLength={3}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              etaOutsideKigali: event.target.value,
            }))
          }
          required
          value={values.etaOutsideKigali}
        />
      </label>
      <label>
        Estimate outside Rwanda
        <input
          maxLength={120}
          minLength={3}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              etaInternational: event.target.value,
            }))
          }
          required
          value={values.etaInternational}
        />
      </label>
      <div aria-live="polite">
        {error && <p className="is-error">{error}</p>}
        {notice && <p className="is-success">{notice}</p>}
      </div>
      <button disabled={busy} type="submit">
        {busy ? "Saving…" : "Save delivery settings"}
      </button>
    </form>
  );
}
