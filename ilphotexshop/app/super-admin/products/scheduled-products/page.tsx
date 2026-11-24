import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, Clock3, Search } from "lucide-react";
import { getSuperAdminProductManagement, SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE } from "@/lib/data-access/super-admin-product-management";

export const metadata: Metadata = { title: "Scheduled Products | ILPhotoX Shop", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function ScheduledProductsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(pageValue ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 500) : 1;
  const data = await getSuperAdminProductManagement("scheduled", query, page);
  const pageCount = Math.max(1, Math.ceil(data.total / SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE));
  if (page > pageCount) redirect(`/super-admin/products/scheduled-products?page=${pageCount}`);
  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading"><div><div className="super-admin-breadcrumb">Workspace / Product Management / Scheduled Products</div><h1>Scheduled Products</h1><p>Review listings assigned to a future publication time.</p></div><Clock3 aria-hidden="true" size={25} /></div>
      <p className="super-admin-data-note" role="note">Approved scheduled listings publish automatically when the configured scheduler calls the protected publishing endpoint.</p>
      <section className="super-admin-panel super-admin-records-panel"><div className="super-admin-records-toolbar"><div><h2>Scheduled listings</h2><p>{data.total.toLocaleString("en-RW")} matching products</p></div><form action="/super-admin/products/scheduled-products" className="super-admin-record-search" role="search"><Search size={17} /><input aria-label="Search scheduled products" defaultValue={query} name="q" maxLength={100} placeholder="Search product or merchant" type="search" /><button type="submit">Search</button></form></div>
        {data.rows.length ? <div className="super-admin-records-table-wrap"><table className="super-admin-records-table"><thead><tr><th>Product</th><th>Merchant</th><th>Category</th><th>Scheduled time</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.rows.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.seller}</td><td>{product.categoryInfo.name}</td><td>{product.scheduledAt ? dateFormat.format(product.scheduledAt) : "—"}</td><td>{product.isPublished ? "Published" : "Approved · waiting to publish"}</td><td><Link className="super-admin-view-action" href={`/super-admin/records/products/${encodeURIComponent(product.id)}`}><Eye size={15} /> View</Link></td></tr>)}</tbody></table></div> : <div className="super-admin-records-empty"><Clock3 size={26} /><strong>No scheduled products</strong><span>Future publication records will appear here.</span></div>}
        {data.total > data.pageSize && <nav aria-label="Scheduled product pagination" className="super-admin-pagination"><span>Page {data.page} of {pageCount}</span><div>{data.page > 1 ? <Link className="super-admin-back-action" href={`/super-admin/products/scheduled-products?page=${data.page - 1}`}><ArrowLeft size={15} /> Previous</Link> : null}{data.page < pageCount ? <Link className="super-admin-primary-action" href={`/super-admin/products/scheduled-products?page=${data.page + 1}`}>Next <ArrowRight size={15} /></Link> : null}</div></nav>}
      </section>
    </div>
  );
}
