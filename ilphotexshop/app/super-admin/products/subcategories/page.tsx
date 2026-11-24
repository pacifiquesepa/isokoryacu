import type { Metadata } from "next";
import { Suspense } from "react";
import { Layers3 } from "lucide-react";
import ProductSubcategoryManager from "@/components/super-admin/product-subcategory-manager";
import { getProductSubcategories } from "@/lib/data-access/super-admin-product-management";

export const metadata: Metadata = { title: "Product Subcategories | ILPhotoX Shop", robots: { index: false, follow: false } };

export default function ProductSubcategoriesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading product subcategories…</div>}>
      <ProductSubcategoriesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductSubcategoriesContent({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);
  const data = await getProductSubcategories(query);
  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading"><div><div className="super-admin-breadcrumb">Workspace / Product Management / Subcategories</div><h1>Product Subcategories</h1><p>Create and manage subcategories inside marketplace categories.</p></div><Layers3 size={25} /></div>
      <section aria-label="Subcategory summary" className="super-admin-records-summary"><article className="super-admin-summary-card is-active"><span>Active</span><strong>{data.active.toLocaleString("en-RW")}</strong></article><article className="super-admin-summary-card"><span>Inactive</span><strong>{data.inactive.toLocaleString("en-RW")}</strong></article></section>
      <ProductSubcategoryManager categories={data.categories} query={query} rows={data.rows} />
    </div>
  );
}
