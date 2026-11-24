import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, PackageCheck, Search } from "lucide-react";
import ProductModerationAction from "@/components/super-admin/product-moderation-action";
import {
  getSuperAdminPendingProducts,
  PRODUCT_MODERATION_PAGE_SIZE,
} from "@/lib/data-access/super-admin-product-moderation";

export const metadata: Metadata = {
  title: "Pending Product Approval | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("en-RW");

export default async function PendingProductApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "")
    .trim()
    .slice(0, 100);
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(pageValue ?? "1", 10);
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 500)
      : 1;
  const data = await getSuperAdminPendingProducts(query, page);
  const pageCount = Math.max(
    1,
    Math.ceil(data.total / PRODUCT_MODERATION_PAGE_SIZE),
  );
  if (page > pageCount) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    search.set("page", String(pageCount));
    redirect(`/super-admin/products/pending-approval?${search.toString()}`);
  }

  function pageHref(nextPage: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    search.set("page", String(nextPage));
    return `/super-admin/products/pending-approval?${search.toString()}`;
  }

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">
            Workspace / Product Management / Pending Approval
          </div>
          <h1>Pending Product Approval</h1>
          <p>Review seller listings before publishing them to the storefront.</p>
        </div>
        <PackageCheck aria-hidden="true" size={25} />
      </div>

      <section aria-label="Product moderation summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card is-active">
          <span>Pending</span>
          <strong>{numberFormat.format(data.summary.pending)}</strong>
        </article>
        <article className="super-admin-summary-card">
          <span>Rejected</span>
          <strong>{numberFormat.format(data.summary.rejected)}</strong>
        </article>
        <article className="super-admin-summary-card">
          <span>Published</span>
          <strong>{numberFormat.format(data.summary.published)}</strong>
        </article>
        <article className="super-admin-summary-card">
          <span>Hidden</span>
          <strong>{numberFormat.format(data.summary.hidden)}</strong>
        </article>
      </section>

      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Listings awaiting review</h2>
            <p>
              {numberFormat.format(data.total)} matching products · page {data.page} of {pageCount}
            </p>
          </div>
          <form
            action="/super-admin/products/pending-approval"
            className="super-admin-record-search"
            role="search"
          >
            <Search aria-hidden="true" size={17} />
            <input
              aria-label="Search pending products"
              defaultValue={query}
              maxLength={100}
              name="q"
              placeholder="Search product, merchant, or location"
              type="search"
            />
            <button type="submit">Search</button>
          </form>
        </div>

        {data.rows.length ? (
          <>
            <div className="super-admin-records-table-wrap">
              <table className="super-admin-records-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Merchant</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="super-admin-featured-product-cell">
                          <Image
                            alt=""
                            height={44}
                            src={product.image}
                            unoptimized
                            width={44}
                          />
                          <strong>{product.name}</strong>
                        </div>
                      </td>
                      <td>{product.seller}</td>
                      <td>{product.categoryInfo.name}</td>
                      <td>{numberFormat.format(product.price)} RWF</td>
                      <td>{numberFormat.format(product.stockQuantity)}</td>
                      <td>{dateFormat.format(product.updatedAt)}</td>
                      <td>
                        <div className="super-admin-table-actions">
                          <Link
                            className="super-admin-view-action"
                            href={`/super-admin/records/products/${encodeURIComponent(product.id)}`}
                          >
                            <Eye aria-hidden="true" size={15} /> View
                          </Link>
                          <ProductModerationAction
                            productId={product.id}
                            productName={product.name}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.total > data.pageSize && (
              <nav aria-label="Pending product pagination" className="super-admin-pagination">
                <span>
                  Showing {(data.page - 1) * data.pageSize + 1}–
                  {Math.min(data.page * data.pageSize, data.total)} of {data.total}
                  <strong>Page {data.page} of {pageCount}</strong>
                </span>
                <div>
                  {data.page > 1 ? (
                    <Link className="super-admin-back-action" href={pageHref(data.page - 1)}>
                      <ArrowLeft size={15} /> Previous
                    </Link>
                  ) : (
                    <span className="super-admin-page-disabled">Previous</span>
                  )}
                  {data.page < pageCount ? (
                    <Link className="super-admin-primary-action" href={pageHref(data.page + 1)}>
                      Next <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <span className="super-admin-page-disabled">Next</span>
                  )}
                </div>
              </nav>
            )}
          </>
        ) : (
          <div className="super-admin-records-empty">
            <PackageCheck aria-hidden="true" size={26} />
            <strong>No products pending approval</strong>
            <span>New or edited seller listings will appear here.</span>
          </div>
        )}
      </section>
    </div>
  );
}
