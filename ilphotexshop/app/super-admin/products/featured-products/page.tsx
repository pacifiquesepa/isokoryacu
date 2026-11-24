import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, Package } from "lucide-react";
import SuperAdminFeaturedProductAction from "@/components/super-admin/featured-product-action";
import {
  getSuperAdminFeaturedProducts,
  SUPER_ADMIN_FEATURED_PRODUCTS_PAGE_SIZE,
} from "@/lib/data-access/super-admin-featured-products";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Featured Products | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const numberFormat = new Intl.NumberFormat("en-RW");
const currencyFormat = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

export default function SuperAdminFeaturedProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading featured products…</div>}>
      <SuperAdminFeaturedProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SuperAdminFeaturedProductsContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "")
    .trim()
    .slice(0, 100);
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number(pageValue ?? "1");
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 500)
      : 1;
  const data = await getSuperAdminFeaturedProducts(query, page);
  const pageCount = Math.max(
    1,
    Math.ceil(data.total / SUPER_ADMIN_FEATURED_PRODUCTS_PAGE_SIZE),
  );

  if (page > pageCount) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    search.set("page", String(pageCount));
    redirect(`/super-admin/products/featured-products?${search.toString()}`);
  }

  function pageHref(nextPage: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    search.set("page", String(nextPage));
    return `/super-admin/products/featured-products?${search.toString()}`;
  }

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / Product Management / Featured Products</div>
          <h1>Featured Products</h1>
          <p>Choose published products to highlight in the storefront.</p>
        </div>
        <Link className="super-admin-back-action" href="/super-admin/products">
          <ArrowLeft aria-hidden="true" size={16} /> All products
        </Link>
      </div>

      <div className="super-admin-data-note" role="note">
        Only published products can be featured. Products are automatically unfeatured when
        unpublished or edited by their merchant.
      </div>

      <section aria-label="Featured product summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card">
          <span>Published products</span>
          <strong>{numberFormat.format(data.publishedCount)}</strong>
        </article>
        <article className="super-admin-summary-card is-approved">
          <span>Featured in storefront</span>
          <strong>{numberFormat.format(data.featuredCount)}</strong>
        </article>
      </section>

      <section className="super-admin-panel super-admin-audit-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Published catalog</h2>
            <p>
              {numberFormat.format(data.total)} matching products · page {data.page} of {pageCount}
            </p>
          </div>
          <form
            action="/super-admin/products/featured-products"
            className="super-admin-record-search"
            role="search"
          >
            <input
              aria-label="Search product or merchant"
              defaultValue={query}
              maxLength={100}
              name="q"
              placeholder="Search products or merchants"
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
                    <th scope="col">Merchant · category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Feature status</th>
                    <th scope="col">Action</th>
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
                          <Link href={`/super-admin/records/products/${encodeURIComponent(product.id)}`}>
                            <strong>{product.name}</strong>
                          </Link>
                        </div>
                      </td>
                      <td>{product.seller} · {product.categoryInfo.name}</td>
                      <td>{currencyFormat.format(product.price)}</td>
                      <td>{numberFormat.format(product.stockQuantity)}</td>
                      <td>
                        <span className={`super-admin-merchant-access-status${product.isFeatured ? "" : " is-suspended"}`}>
                          {product.isFeatured ? "Featured" : "Standard"}
                        </span>
                      </td>
                      <td>
                        <div className="super-admin-featured-product-actions">
                          <SuperAdminFeaturedProductAction
                            isFeatured={product.isFeatured}
                            productId={product.id}
                          />
                          <Link
                            aria-label={`View ${product.name}`}
                            className="super-admin-view-action"
                            href={`/super-admin/records/products/${encodeURIComponent(product.id)}`}
                          >
                            <Eye aria-hidden="true" size={15} /> View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.total > data.pageSize && (
              <nav aria-label="Featured product pagination" className="super-admin-pagination">
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
            <Package aria-hidden="true" size={26} />
            <strong>{query ? "No matching published products" : "No published products"}</strong>
            <span>
              {query
                ? "Try changing the product or merchant search."
                : "Published products will appear here when available."}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
