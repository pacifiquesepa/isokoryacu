import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, ArrowUpRight, Boxes, History } from "lucide-react";
import MerchantInventoryAdjustForm from "@/components/merchant/inventory-adjust-form";
import { requireMerchantPageUser } from "@/lib/authorization";
import {
  getMerchantInventory,
  getMerchantStockMovements,
} from "@/lib/data-access/merchant-inventory";

export const metadata: Metadata = {
  title: "Inventory | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function MerchantInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading inventory…</div>}>
      <MerchantInventoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MerchantInventoryContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  const [{ status }, merchant] = await Promise.all([
    searchParams,
    requireMerchantPageUser(),
  ]);
  const [allProducts, movements] = await Promise.all([
    getMerchantInventory(merchant),
    getMerchantStockMovements(merchant),
  ]);
  const lowStock = allProducts.filter((product) => product.isLowStock);
  const products = status === "low-stock" ? lowStock : allProducts;

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Inventory</div>
          <h1>Inventory</h1>
          <p>Review stock levels and record every adjustment with a reason.</p>
        </div>
        <Link className="merchant-primary-action" href="/merchant/products/new">
          <Boxes size={17} /> Add product
        </Link>
      </div>

      <section aria-label="Inventory summary" className="merchant-metrics">
        <article className="merchant-metric-card is-blue">
          <span className="merchant-metric-top">Products</span>
          <strong>{numberFormat.format(products.length)}</strong>
          <small>Products in your inventory</small>
        </article>
        <article className="merchant-metric-card is-red">
          <span className="merchant-metric-top">Low stock</span>
          <strong>{numberFormat.format(lowStock.length)}</strong>
          <small>At or below their alert threshold</small>
        </article>
        <article className="merchant-metric-card is-green">
          <span className="merchant-metric-top">Movements</span>
          <strong>{numberFormat.format(movements.length)}</strong>
          <small>Most recent stock activity</small>
        </article>
      </section>

      {lowStock.length > 0 && (
        <div className="merchant-info-banner is-warning" role="status">
          <AlertTriangle size={18} />
          {lowStock.length} product{lowStock.length === 1 ? "" : "s"} need restocking.
          <Link href="/merchant/inventory?status=low-stock">
            Review inventory <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      <section className="merchant-panel merchant-dashboard-section">
        <nav aria-label="Inventory filter" className="merchant-filter-tabs">
          <Link
            aria-current={status !== "low-stock" ? "page" : undefined}
            className={status !== "low-stock" ? "is-active" : ""}
            href="/merchant/inventory"
          >
            All products<span>{numberFormat.format(allProducts.length)}</span>
          </Link>
          <Link
            aria-current={status === "low-stock" ? "page" : undefined}
            className={status === "low-stock" ? "is-active" : ""}
            href="/merchant/inventory?status=low-stock"
          >
            Low stock<span>{numberFormat.format(lowStock.length)}</span>
          </Link>
        </nav>
        <div className="merchant-panel-heading">
          <div>
            <h2><Boxes size={18} /> Stock levels</h2>
            <p>Category thresholds and product overrides are applied automatically.</p>
          </div>
        </div>
        {products.length ? (
          <div className="merchant-table-wrap is-polished-table is-inventory-table">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Alert at</th>
                  <th scope="col">Status</th>
                  <th scope="col">Adjust stock</th>
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
                        <strong>{product.name}</strong>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td>{numberFormat.format(product.stockQuantity)}</td>
                    <td>{numberFormat.format(product.lowStockThreshold)}</td>
                    <td>
                      <span className={`merchant-status ${product.isLowStock ? "is-cancelled" : "is-fulfilled"}`}>
                        {product.isLowStock ? "Low stock" : "In stock"}
                      </span>
                    </td>
                    <td>
                      <MerchantInventoryAdjustForm
                        productId={product.id}
                        quantity={product.stockQuantity}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><strong>No products yet</strong><span>Add a product to start managing stock.</span></div>
        )}
      </section>

      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div>
            <h2><History size={18} /> Stock movement history</h2>
            <p>Opening balances, sales, reversals, and manual adjustments.</p>
          </div>
        </div>
        {movements.length ? (
          <div className="merchant-table-wrap is-polished-table is-inventory-table">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Product</th>
                  <th scope="col">Movement</th>
                  <th scope="col">Change</th>
                  <th scope="col">Before → after</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{dateFormat.format(movement.createdAt)}</td>
                    <td>{movement.productName}</td>
                    <td>{movement.type.replaceAll("_", " ")}</td>
                    <td>{movement.quantityChange > 0 ? "+" : ""}{numberFormat.format(movement.quantityChange)}</td>
                    <td>{numberFormat.format(movement.quantityBefore)} → {numberFormat.format(movement.quantityAfter)}</td>
                    <td>{movement.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><strong>No stock movements</strong><span>Inventory activity will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
