"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ProductCategoryRow = {
  slug: string;
  name: string;
  description: string | null;
  commissionBasisPoints: number | null;
  lowStockThreshold: number | null;
  _count: { products: number; subcategories: number };
};

export default function ProductCategoryManager({
  categories,
}: {
  categories: ProductCategoryRow[];
}) {
  const router = useRouter();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function resetForm() {
    setEditingSlug(null);
    setSlug("");
    setName("");
    setDescription("");
    setCommissionPercent("");
    setLowStockThreshold("");
  }

  function edit(category: ProductCategoryRow) {
    setEditingSlug(category.slug);
    setSlug(category.slug);
    setName(category.name);
    setDescription(category.description ?? "");
    setCommissionPercent(
      category.commissionBasisPoints === null
        ? ""
        : String(category.commissionBasisPoints / 100),
    );
    setLowStockThreshold(
      category.lowStockThreshold === null
        ? ""
        : String(category.lowStockThreshold),
    );
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/super-admin/products/categories", {
        method: editingSlug ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          description,
          commissionBasisPoints:
            commissionPercent === ""
              ? null
              : Math.round(Number(commissionPercent) * 100),
          lowStockThreshold:
            lowStockThreshold === "" ? null : Number(lowStockThreshold),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Category could not be saved");
      resetForm();
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Category could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: ProductCategoryRow) {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    setBusySlug(category.slug);
    setMessage("");
    try {
      const response = await fetch("/api/super-admin/products/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: category.slug }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Category could not be deleted");
      if (editingSlug === category.slug) resetForm();
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Category could not be deleted");
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <>
      <section className="super-admin-panel super-admin-announcement-create-panel">
        <div className="super-admin-panel-heading">
          <div>
            <h2>{editingSlug ? "Edit category" : "Add category"}</h2>
            <p>{editingSlug ? "The category slug stays unchanged to preserve product links." : "Create a category for product listings."}</p>
          </div>
        </div>
        <form className="super-admin-announcement-form-grid" onSubmit={submit}>
          <label>
            Name
            <input maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            Slug
            <input
              disabled={Boolean(editingSlug)}
              maxLength={80}
              onChange={(event) => setSlug(event.target.value)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={slug}
            />
          </label>
          <label>
            Description
            <input maxLength={500} onChange={(event) => setDescription(event.target.value)} value={description} />
          </label>
          <label>
            Commission override (%)
            <input
              max="100"
              min="0"
              onChange={(event) => setCommissionPercent(event.target.value)}
              placeholder="Default: 2%"
              step="0.01"
              type="number"
              value={commissionPercent}
            />
          </label>
          <label>
            Low-stock threshold
            <input
              max="1000000"
              min="0"
              onChange={(event) => setLowStockThreshold(event.target.value)}
              placeholder="Default: 3 units"
              step="1"
              type="number"
              value={lowStockThreshold}
            />
          </label>
          <div className="super-admin-confirm-actions">
            <button className="super-admin-primary-action" disabled={busy} type="submit">
              {busy ? "Saving…" : editingSlug ? "Save changes" : "Add category"}
            </button>
            {editingSlug && (
              <button className="super-admin-row-action" disabled={busy} onClick={resetForm} type="button">
                Cancel
              </button>
            )}
            {message && <span className="super-admin-row-action-error" role="alert">{message}</span>}
          </div>
        </form>
      </section>

      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Product categories</h2>
            <p>{categories.length.toLocaleString("en-RW")} categories</p>
          </div>
        </div>
        {categories.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead>
                <tr><th>Name</th><th>Slug</th><th>Commission</th><th>Low stock</th><th>Products</th><th>Subcategories</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const inUse = category._count.products > 0 || category._count.subcategories > 0;
                  return (
                    <tr key={category.slug}>
                      <td><strong>{category.name}</strong>{category.description && <span className="super-admin-audit-secondary">{category.description}</span>}</td>
                      <td><code>{category.slug}</code></td>
                      <td>{category.commissionBasisPoints === null ? "Default 2%" : `${(category.commissionBasisPoints / 100).toFixed(2)}%`}</td>
                      <td>{category.lowStockThreshold === null ? "Default 3" : category.lowStockThreshold}</td>
                      <td>{category._count.products.toLocaleString("en-RW")}</td>
                      <td>{category._count.subcategories.toLocaleString("en-RW")}</td>
                      <td>
                        <div className="super-admin-confirm-actions">
                          <button className="super-admin-row-action" disabled={busy} onClick={() => edit(category)} type="button">Edit</button>
                          <button
                            className="super-admin-row-action"
                            disabled={Boolean(busySlug) || inUse}
                            onClick={() => void remove(category)}
                            title={inUse ? "Remove all products and subcategories before deleting this category" : undefined}
                            type="button"
                          >
                            {busySlug === category.slug ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty"><strong>No categories yet</strong><span>Add the first category above.</span></div>
        )}
      </section>
    </>
  );
}
