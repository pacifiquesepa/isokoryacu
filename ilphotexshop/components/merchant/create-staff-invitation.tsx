"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function CreateStaffInvitation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/seller/staff/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          merchantRole: String(formData.get("merchantRole") ?? ""),
          canManageProducts: formData.get("canManageProducts") === "on",
          canManageOrders: formData.get("canManageOrders") === "on",
          canManageStaff: formData.get("canManageStaff") === "on",
          canManageFinancialProfile: formData.get("canManageFinancialProfile") === "on",
        }),
      });
      const result = await response.json().catch(() => null) as
        | { error?: string; acceptUrl?: string }
        | null;
      if (!response.ok) throw new Error(result?.error ?? "Invitation could not be created.");
      form.reset();
      setNotice("Invitation created. Secure acceptance link: " + (result?.acceptUrl ?? ""));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="merchant-form-grid" onSubmit={submit}>
      <label>Name<input name="name" maxLength={100} minLength={2} required /></label>
      <label>Email<input name="email" maxLength={254} required type="email" /></label>
      <label>
        Role
        <select name="merchantRole" defaultValue="support">
          <option value="owner">Shop owner</option>
          <option value="manager">Shop manager</option>
          <option value="operations">Operations</option>
          <option value="support">Customer support</option>
          <option value="finance">Accountant</option>
        </select>
      </label>
      <fieldset>
        <legend>Permissions</legend>
        <label><input name="canManageProducts" type="checkbox" /> Manage products</label>
        <label><input name="canManageOrders" type="checkbox" /> Manage orders</label>
        <label><input name="canManageStaff" type="checkbox" /> Manage staff</label>
        <label><input name="canManageFinancialProfile" type="checkbox" /> Manage financial profile</label>
      </fieldset>
      <button className="merchant-primary-action" disabled={busy} type="submit">{busy ? "Creating…" : "Create invitation"}</button>
      {error && <p className="merchant-form-error" role="alert">{error}</p>}
      {notice && <p className="merchant-form-success" role="status">{notice}</p>}
    </form>
  );
}
