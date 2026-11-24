"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type CategoryOption = { slug: string; name: string };
type ProductSubcategoryRow = {
  id: string;
  category: string;
  categoryInfo: { name: string };
  name: string;
  slug: string;
  commissionBasisPoints: number | null;
  isActive: boolean;
  _count: { products: number };
};

export default function ProductSubcategoryManager({
  categories,
  rows,
  query,
}: {
  categories: CategoryOption[];
  rows: ProductSubcategoryRow[];
  query: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductSubcategoryRow | null>(null);
  const [category, setCategory] = useState(categories[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function resetForm() {
    setEditing(null);
    setCategory(categories[0]?.slug ?? "");
    setName("");
    setSlug("");
    setCommissionPercent("");
  }

  function startEditing(row: ProductSubcategoryRow) {
    setEditing(row);
    setCategory(row.category);
    setName(row.name);
    setSlug(row.slug);
    setCommissionPercent(
      row.commissionBasisPoints === null
        ? ""
        : String(row.commissionBasisPoints / 100),
    );
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/super-admin/products/subcategories", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          category,
          name,
          slug,
          commissionBasisPoints:
            commissionPercent === ""
              ? null
              : Math.round(Number(commissionPercent) * 100),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Subcategory could not be saved");
      resetForm();
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Subcategory could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(row: ProductSubcategoryRow) {
    setBusyId(row.id);
    setMessage("");
    try {
      const response = await fetch("/api/super-admin/products/subcategories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, isActive: !row.isActive }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Subcategory status could not be changed");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Subcategory status could not be changed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: ProductSubcategoryRow) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    setMessage("");
    try {
      const response = await fetch("/api/super-admin/products/subcategories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Subcategory could not be deleted");
      if (editing?.id === row.id) resetForm();
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Subcategory could not be deleted");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <section className="super-admin-panel super-admin-announcement-create-panel">
        <div className="super-admin-panel-heading">
          <div>
            <h2>{editing ? "Edit subcategory" : "Add subcategory"}</h2>
            <p>{editing ? "Update the name, slug, or parent category." : "Choose a parent category and add a subcategory."}</p>
          </div>
        </div>
        <form className="super-admin-announcement-form-grid" onSubmit={submit}>
          <label>
            Category
            <select
              disabled={Boolean(editing && editing._count.products > 0)}
              onChange={(event) => setCategory(event.target.value)}
              required
              value={category}
            >
              {categories.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input maxLength={160} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            Slug
            <input maxLength={180} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={slug} />
          </label>
          <label>
            Commission override (%)
            <input
              max="100"
              min="0"
              onChange={(event) => setCommissionPercent(event.target.value)}
              placeholder="Use category rate or default 2%"
              step="0.01"
              type="number"
              value={commissionPercent}
            />
          </label>
          <div className="super-admin-confirm-actions">
            <button className="super-admin-primary-action" disabled={busy || categories.length === 0} type="submit">
              {busy ? "Saving…" : editing ? "Save changes" : "Add subcategory"}
            </button>
            {editing && (
              <button className="super-admin-row-action" disabled={busy} onClick={resetForm} type="button">Cancel</button>
            )}
            {message && <span className="super-admin-row-action-error" role="alert">{message}</span>}
          </div>
        </form>
      </section>

      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar">
          <div><h2>Subcategory catalog</h2><p>{rows.length.toLocaleString("en-RW")} subcategories</p></div>
          <form action="/super-admin/products/subcategories" className="super-admin-record-search" role="search">
            <input aria-label="Search subcategories" defaultValue={query} maxLength={100} name="q" placeholder="Search name or slug" type="search" />
            <button type="submit">Search</button>
          </form>
        </div>
        {rows.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead><tr><th>Name</th><th>Category</th><th>Slug</th><th>Commission</th><th>Products</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.categoryInfo.name}</td>
                    <td><code>{row.slug}</code></td>
                    <td>{row.commissionBasisPoints === null ? "Inherits category/default" : `${(row.commissionBasisPoints / 100).toFixed(2)}%`}</td>
                    <td>{row._count.products.toLocaleString("en-RW")}</td>
                    <td>{row.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      <div className="super-admin-confirm-actions">
                        <button className="super-admin-row-action" disabled={Boolean(busyId)} onClick={() => startEditing(row)} type="button">Edit</button>
                        <button className="super-admin-row-action" disabled={busyId === row.id} onClick={() => void changeStatus(row)} type="button">
                          {busyId === row.id ? "Saving…" : row.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button className="super-admin-row-action" disabled={Boolean(busyId) || row._count.products > 0} onClick={() => void remove(row)} title={row._count.products > 0 ? "Remove product assignments before deleting this subcategory" : undefined} type="button">
                          {busyId === row.id ? "Working…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty"><strong>No subcategories</strong><span>Create the first subcategory above.</span></div>
        )}
      </section>
    </>
  );
}
