import type { Metadata } from "next";
import Link from "next/link";
import { ChartNoAxesCombined, Package } from "lucide-react";
import { requireMerchantWorkspacePermission, requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Product Performance | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");

export default async function MerchantProductPerformancePage() {
  await requireMerchantWorkspacePermission("canManageProducts");
  const merchant = await requireMerchantPageUser();

  const [products, salesRows, viewsRows] = await prisma.$transaction([
    prisma.product.findMany({
      where: { ownerId: merchant.id },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
        rating: true,
        reviewCount: true,
        isPublished: true,
        isFeatured: true,
      },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        sellerId: merchant.id,
        productId: { not: null },
        order: { status: { in: ["delivered", "fulfilled"] } },
      },
      _sum: { quantity: true, merchantLineTotal: true },
      orderBy: { productId: "desc" },
    }),
    prisma.productView.findMany({
      where: { product: { ownerId: merchant.id } },
      select: { productId: true },
    }),
  ]);

  const salesMap = new Map(
    salesRows.map((row) => [
      row.productId,
      {
        units: row._sum?.quantity ?? 0,
        revenue: row._sum?.merchantLineTotal ?? 0,
      },
    ]),
  );
  const viewsMap = new Map<string, number>();
  for (const view of viewsRows) {
    if (!view.productId) continue;
    viewsMap.set(view.productId, (viewsMap.get(view.productId) ?? 0) + 1);
  }
  const rows = products
    .map((product) => {
      const sales = salesMap.get(product.id) ?? { units: 0, revenue: 0 };
      const views = viewsMap.get(product.id) ?? 0;
      return {
        ...product,
        ...sales,
        views,
        conversion: views ? (sales.units / views) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Products / Performance</div>
          <h1>Product Performance</h1>
          <p>Views, sales, revenue, rating and conversion for this merchant&apos;s catalog.</p>
        </div>
        <Link className="merchant-primary-action" href="/merchant/products">
          <Package size={17} /> All products
        </Link>
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        {rows.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Views</th>
                  <th scope="col">Units sold</th>
                  <th scope="col">Revenue</th>
                  <th scope="col">Conversion</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      {product.sku && <small>SKU: {product.sku}</small>}
                    </td>
                    <td>{numberFormat.format(product.views)}</td>
                    <td>{numberFormat.format(product.units)}</td>
                    <td>{numberFormat.format(product.revenue)} RWF</td>
                    <td>{product.conversion.toFixed(2)}%</td>
                    <td>{product.rating.toFixed(1)} ({product.reviewCount})</td>
                    <td>
                      <Link
                        className="merchant-table-action"
                        href={`/merchant/products/${encodeURIComponent(product.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state">
            <ChartNoAxesCombined aria-hidden="true" size={28} />
            <strong>No product performance data</strong>
            <span>Add products and record storefront activity to populate this report.</span>
          </div>
        )}
      </section>
    </div>
  );
}
