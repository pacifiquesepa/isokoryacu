import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, Search } from "lucide-react";
import { getSuperAdminProductManagement } from "@/lib/data-access/super-admin-product-management";

export const metadata: Metadata = { title: "Hidden Products | ILPhotoX Shop", robots: { index: false, follow: false } };

export default async function HiddenProductsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);
  const data = await getSuperAdminProductManagement("hidden", query, 1);
  return <div className="super-admin-records-page"><div className="super-admin-records-heading"><div><div className="super-admin-breadcrumb">Workspace / Product Management / Hidden Products</div><h1>Hidden Products</h1><p>Listings removed from storefront publication.</p></div><EyeOff size={25} /></div><section className="super-admin-panel super-admin-records-panel"><div className="super-admin-records-toolbar"><div><h2>Hidden listings</h2><p>{data.total.toLocaleString("en-RW")} matching products</p></div><form action="/super-admin/products/hidden-products" className="super-admin-record-search" role="search"><Search size={17} /><input aria-label="Search hidden products" defaultValue={query} name="q" maxLength={100} placeholder="Search product or merchant" type="search" /><button type="submit">Search</button></form></div>{data.rows.length ? <div className="super-admin-records-table-wrap"><table className="super-admin-records-table"><thead><tr><th>Product</th><th>Merchant</th><th>Category</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.rows.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.seller}</td><td>{product.categoryInfo.name}</td><td>Hidden</td><td><Link className="super-admin-view-action" href={`/super-admin/records/products/${encodeURIComponent(product.id)}`}><Eye size={15} /> View</Link></td></tr>)}</tbody></table></div> : <div className="super-admin-records-empty"><EyeOff size={26} /><strong>No hidden products</strong><span>Admin-hidden listings will appear here.</span></div>}</section></div>;
}
