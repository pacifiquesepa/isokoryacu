"use client";

import { useEffect, useState, type FormEvent } from "react";

export default function MerchantPreferencesForm() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [values, setValues] = useState({
    notificationEmail: true,
    notificationInApp: true,
    notificationWhatsapp: false,
    appearance: "system",
    language: "en",
  });

  useEffect(() => {
    fetch("/api/seller/preferences", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Preferences could not be loaded.");
        const data = await response.json();
        setValues({
          notificationEmail: Boolean(data.notificationEmail),
          notificationInApp: Boolean(data.notificationInApp),
          notificationWhatsapp: Boolean(data.notificationWhatsapp),
          appearance: data.appearance ?? "system",
          language: data.language ?? "en",
        });
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Preferences could not be loaded."))
      .finally(() => setBusy(false));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/seller/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Preferences could not be saved.");
      setNotice("Preferences saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preferences could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="merchant-form-grid" onSubmit={save}>
      <fieldset>
        <legend>Notifications</legend>
        <label><input checked={values.notificationEmail} onChange={(event) => setValues((current) => ({ ...current, notificationEmail: event.target.checked }))} type="checkbox" /> Email notifications</label>
        <label><input checked={values.notificationInApp} onChange={(event) => setValues((current) => ({ ...current, notificationInApp: event.target.checked }))} type="checkbox" /> In-app notifications</label>
        <label><input checked={values.notificationWhatsapp} onChange={(event) => setValues((current) => ({ ...current, notificationWhatsapp: event.target.checked }))} type="checkbox" /> WhatsApp notifications</label>
      </fieldset>
      <label>
        Appearance
        <select value={values.appearance} onChange={(event) => setValues((current) => ({ ...current, appearance: event.target.value }))}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        Language
        <select value={values.language} onChange={(event) => setValues((current) => ({ ...current, language: event.target.value }))}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="rw">Ikinyarwanda</option>
        </select>
      </label>
      <div className="merchant-form-actions">
        <button className="merchant-primary-action" disabled={busy} type="submit">{busy ? "Saving…" : "Save preferences"}</button>
      </div>
      {error && <p className="merchant-form-error" role="alert">{error}</p>}
      {notice && <p className="merchant-form-success" role="status">{notice}</p>}
    </form>
  );
}
