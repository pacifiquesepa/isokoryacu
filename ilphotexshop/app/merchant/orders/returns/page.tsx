import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { requireMerchantWorkspacePermission, requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Return Requests | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeZone: "UTC" });

export default async function MerchantReturnsPage() {
  await requireMerchantWorkspacePermission("canManageOrders");
  const merchant = await requireMerchantPageUser();
  const refunds = await prisma.orderRefund.findMany({
    where: { order: { items: { some: { sellerId: merchant.id } } } },
    select: {
      id: true,
      orderId: true,
      amount: true,
      currency: true,
      reason: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Orders / Returns</div><h1>Return Requests</h1><p>Refund requests involving this merchant&apos;s order items.</p></div>
        <Link className="merchant-secondary-action" href="/merchant/orders">All orders</Link>
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        {refunds.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead><tr><th>Order</th><th>Amount</th><th>Reason</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td><strong>#{refund.orderId.slice(-8).toUpperCase()}</strong></td>
                    <td>{refund.amount.toLocaleString("en-RW")} {refund.currency}</td>
                    <td>{refund.reason}</td>
                    <td><span className={`merchant-status is-${refund.status}`}>{refund.status}</span></td>
                    <td>{dateFormat.format(refund.createdAt)}</td>
                    <td><Link className="merchant-table-action" href={`/merchant/orders/${encodeURIComponent(refund.orderId)}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><RotateCcw size={28} /><strong>No return requests</strong><span>Refund requests involving your items will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
