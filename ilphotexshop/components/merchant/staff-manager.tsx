"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type UserOption = { id: string; name: string; email: string };
type StaffRow = {
  id: string;
  role: "owner" | "manager" | "operations" | "support" | "finance";
  status: "active" | "inactive";
  canManageProducts: boolean;
  canManageOrders: boolean;
  canManageStaff: boolean;
  canManageFinancialProfile: boolean;
  user: { id: string; name: string; email: string };
};

export default function MerchantStaffManager({
  availableUsers,
  rows,
}: {
  availableUsers: UserOption[];
  rows: StaffRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applyRolePreset(
    role: StaffRow["role"],
    form: HTMLFormElement,
  ) {
    const presets: Record<StaffRow["role"], [boolean, boolean, boolean, boolean]> = {
      owner: [true, true, true, true],
      manager: [true, true, true, false],
      operations: [true, true, false, false],
      support: [false, false, false, false],
      finance: [false, false, false, true],
    };
    const [products, orders, staff, finance] = presets[role];
    const checkboxes = [
      ["canManageProducts", products],
      ["canManageOrders", orders],
      ["canManageStaff", staff],
      ["canManageFinancialProfile", finance],
    ] as const;
    for (const [name, checked] of checkboxes) {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) input.checked = checked;
    }
  }

  async function saveAssignment(
    event: FormEvent<HTMLFormElement>,
    existing?: StaffRow,
  ) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/seller/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: existing?.user.id ?? String(formData.get("userId")),
          role: String(formData.get("role")),
          canManageProducts: formData.get("canManageProducts") === "on",
          canManageOrders: formData.get("canManageOrders") === "on",
          canManageStaff: formData.get("canManageStaff") === "on",
          canManageFinancialProfile:
            formData.get("canManageFinancialProfile") === "on",
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "Staff assignment could not be saved.");
      }
      setNotice(existing ? "Staff permissions updated." : "Staff assignment added.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Staff assignment could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(staffId: string, status: "active" | "inactive") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/seller/staff/${encodeURIComponent(staffId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "Staff status could not be changed.");
      }
      setNotice(status === "active" ? "Staff account activated." : "Staff account suspended.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Staff status could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {availableUsers.length > 0 && (
        <section className="merchant-panel merchant-form-panel">
          <div className="merchant-panel-heading">
            <div>
              <h2>Add staff</h2>
              <p>Assign an existing active account to this shop.</p>
            </div>
          </div>
          <form
            className="merchant-form-grid"
            onSubmit={(event) => saveAssignment(event)}
          >
            <label>
              Staff account
              <select name="userId" required>
                <option value="">Choose account</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Role
              <select name="role" defaultValue="support" onChange={(event) => applyRolePreset(event.target.value as StaffRow["role"], event.currentTarget.form!)}>
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
            <button className="merchant-primary-action" disabled={busy} type="submit">
              {busy ? "Saving…" : "Add staff"}
            </button>
          </form>
        </section>
      )}

      {rows.map((staff) => (
        <section className="merchant-panel merchant-form-panel" key={staff.id}>
          <div className="merchant-panel-heading">
            <div>
              <h2>{staff.user.name}</h2>
              <p>{staff.user.email}</p>
            </div>
            <span className={`merchant-status is-${staff.status}`}>
              {staff.status}
            </span>
          </div>
          <form
            className="merchant-form-grid"
            onSubmit={(event) => saveAssignment(event, staff)}
          >
            <label>
              Role
              <select defaultValue={staff.role} name="role" onChange={(event) => applyRolePreset(event.target.value as StaffRow["role"], event.currentTarget.form!)}>
                <option value="owner">Shop owner</option>
                <option value="manager">Shop manager</option>
                <option value="operations">Operations</option>
                <option value="support">Customer support</option>
                <option value="finance">Accountant</option>
              </select>
            </label>
            <fieldset>
              <legend>Permissions</legend>
              <label><input defaultChecked={staff.canManageProducts} name="canManageProducts" type="checkbox" /> Manage products</label>
              <label><input defaultChecked={staff.canManageOrders} name="canManageOrders" type="checkbox" /> Manage orders</label>
              <label><input defaultChecked={staff.canManageStaff} name="canManageStaff" type="checkbox" /> Manage staff</label>
              <label><input defaultChecked={staff.canManageFinancialProfile} name="canManageFinancialProfile" type="checkbox" /> Manage financial profile</label>
            </fieldset>
            <div className="merchant-form-actions">
              <button className="merchant-secondary-action" disabled={busy} type="submit">
                Save permissions
              </button>
              <button
                className={staff.status === "active" ? "merchant-table-action is-danger" : "merchant-secondary-action"}
                disabled={busy}
                onClick={() =>
                  setStatus(staff.id, staff.status === "active" ? "inactive" : "active")
                }
                type="button"
              >
                {staff.status === "active" ? "Suspend" : "Activate"}
              </button>
            </div>
          </form>
        </section>
      ))}
      {error && <p className="merchant-form-error" role="alert">{error}</p>}
      {notice && <p className="merchant-form-success" role="status">{notice}</p>}
    </div>
  );
}
