import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Package, PackagePlus } from "lucide-react";
import MerchantProductActions from "@/components/merchant/product-actions";
import { requireMerchantPageUser } from "@/lib/authorization";
import {
  getMerchantProducts,
  type MerchantProductFilter,
} from "@/lib/data-access/merchant-dashboard";
import {
  listProductsQuerySchema,
} from "@/lib/validation/products";
import { getActiveProductCategories } from "@/lib/data-access/products";

export const metadata: Metadata = {
  title: "My products | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function MerchantProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading your products…</div>}>
      <MerchantProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MerchantProductsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [seller, params] = await Promise.all([
    requireMerchantPageUser(),
    searchParams,
  ]);
  const statusValue = typeof params.status === "string" ? params.status : "all";
  const filter: MerchantProductFilter =
    statusValue === "published" ||
    statusValue === "unpublished" ||
    statusValue === "draft" ||
    statusValue === "pending" ||
    statusValue === "scheduled" ||
    statusValue === "rejected" ||
    statusValue === "hidden"
      ? statusValue
      : "all";
  const queryInput = {
    q: typeof params.q === "string" ? params.q : "",
    category: typeof params.category === "string" ? params.category : undefined,
    sort: typeof params.sort === "string" ? params.sort : undefined,
    limit: typeof params.limit === "string" ? params.limit : "20",
    offset: typeof params.offset === "string" ? params.offset : "0",
  };
  const parsedQuery = listProductsQuerySchema.safeParse(queryInput);
  const query = parsedQuery.success
    ? parsedQuery.data
    : listProductsQuerySchema.parse({});
  const [productData, categories] = await Promise.all([
    getMerchantProducts(
    seller,
    query,
    filter,
    ),
    getActiveProductCategories(),
  ]);
  const { products, total, summary } = productData;
  const pageNumber = Math.floor(query.offset / query.limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / query.limit));
  const baseParams = new URLSearchParams();
  if (query.q) baseParams.set("q", query.q);
  if (query.category) baseParams.set("category", query.category);
  if (query.sort !== "recommended") baseParams.set("sort", query.sort);
  if (filter !== "all") baseParams.set("status", filter);
  baseParams.set("limit", String(query.limit));
  const previousParams = new URLSearchParams(baseParams);
  previousParams.set("offset", String(Math.max(0, query.offset - query.limit)));
  const nextParams = new URLSearchParams(baseParams);
  nextParams.set("offset", String(query.offset + query.limit));

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Products</div>
          <h1>My products</h1>
          <p>Manage your listings, stock, and storefront visibility.</p>
        </div>
        <Link className="merchant-primary-action" href="/merchant/products/new">
          <PackagePlus size={17} /> Add product
        </Link>
      </div>

      <section aria-label="Product summary" className="merchant-product-summary">
        <div><strong>{numberFormat.format(summary.totalProducts)}</strong><span>All products</span></div>
        <div><strong>{numberFormat.format(summary.publishedProducts)}</strong><span>Published</span></div>
        <div><strong>{numberFormat.format(summary.unpublishedProducts)}</strong><span>Unpublished</span></div>
        <div><strong>{numberFormat.format(summary.outOfStockProducts)}</strong><span>Out of stock</span></div>
      </section>

      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-product-filters">
          <nav aria-label="Filter products" className="merchant-filter-tabs">
            {[
              { label: "All", value: "all", count: summary.totalProducts },
              { label: "Published", value: "published", count: summary.publishedProducts },
              { label: "Unpublished", value: "unpublished", count: summary.unpublishedProducts },
            ].map((item) => {
              const paramsForTab = new URLSearchParams(baseParams);
              paramsForTab.delete("offset");
              if (item.value === "all") paramsForTab.delete("status");
              else paramsForTab.set("status", item.value);
              return (
                <Link
                  aria-current={filter === item.value ? "page" : undefined}
                  className={filter === item.value ? "is-active" : ""}
                  href={`/merchant/products${paramsForTab.size ? `?${paramsForTab}` : ""}`}
                  key={item.value}
                >
                  {item.label}<span>{numberFormat.format(item.count)}</span>
                </Link>
              );
            })}
          </nav>
          <form action="/merchant/products" className="merchant-filter-form" method="get">
            <label>
              <span>Listing status</span>
              <select defaultValue={filter === "all" ? "" : filter} name="status">
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending review</option>
                <option value="scheduled">Scheduled</option>
                <option value="rejected">Rejected</option>
                <option value="hidden">Hidden</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </label>
            <label>
              <span>Category</span>
              <select defaultValue={query.category ?? ""} name="category">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort by</span>
              <select defaultValue={query.sort} name="sort">
                <option value="recommended">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Rating</option>
              </select>
            </label>
            {query.q && <input name="q" type="hidden" value={query.q} />}
            <button className="merchant-primary-action" type="submit">Apply</button>
          </form>
        </div>

        {products.length ? (
          <>
            <div className="merchant-table-wrap">
              <table className="merchant-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="merchant-product-cell">
                          <Image
                            alt=""
                            className="merchant-product-thumb"
                            height={44}
                            src={product.image}
                            unoptimized
                            width={44}
                          />
                          <div>
                            <strong>{product.name}</strong>
                            {product.sku && <small>SKU: {product.sku}</small>}
                          </div>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>{numberFormat.format(product.price)} RWF</td>
                      <td>{numberFormat.format(product.stockQuantity)}</td>
                      <td>{product.rating.toFixed(1)} ({product.reviewCount})</td>
                      <td>
                        <span className={`merchant-status is-${product.isPublished ? "published" : "unpublished"}`}>
                          {product.isPublished
                            ? "Published"
                            : product.moderationStatus === "pending"
                              ? "Pending review"
                              : product.moderationStatus === "scheduled"
                                ? "Scheduled"
                                : product.moderationStatus === "rejected"
                                  ? "Rejected"
                                  : product.moderationStatus === "hidden"
                                    ? "Hidden"
                                    : "Draft"}
                        </span>
                        {!product.isPublished && product.scheduledAt && (
                          <small>Publish at {dateFormat.format(product.scheduledAt)} UTC</small>
                        )}
                      </td>
                      <td><MerchantProductActions id={product.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="merchant-pagination">
              <span>
                Showing {total ? query.offset + 1 : 0}–{Math.min(query.offset + query.limit, total)} of {numberFormat.format(total)}
              </span>
              <div>
                {query.offset > 0 && (
                  <Link className="merchant-secondary-action" href={`/merchant/products?${previousParams}`}>
                    Previous
                  </Link>
                )}
                <span>Page {pageNumber} of {pageCount}</span>
                {query.offset + query.limit < total && (
                  <Link className="merchant-primary-action" href={`/merchant/products?${nextParams}`}>
                    Next
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="merchant-empty-state">
            <Package aria-hidden="true" size={27} />
            <strong>{query.q ? "No matching products" : "No products in this view"}</strong>
            <span>
              {query.q
                ? "Try a different search or remove filters."
                : "Create a product listing to add it to your catalog."}
            </span>
            {!query.q && (
              <Link className="merchant-primary-action" href="/merchant/products/new">
                <PackagePlus size={16} /> Add product
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
