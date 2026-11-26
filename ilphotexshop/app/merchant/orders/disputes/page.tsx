import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleWarning } from "lucide-react";
import { requireMerchantWorkspacePermission, requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Order Disputes | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeZone: "UTC" });

export default async function MerchantDisputesPage() {
  await requireMerchantWorkspacePermission("canManageOrders");
  const merchant = await requireMerchantPageUser();
  const disputes = await prisma.orderDispute.findMany({
    where: { order: { items: { some: { sellerId: merchant.id } } } },
    select: {
      id: true,
      orderId: true,
      reason: true,
      resolution: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Orders / Disputes</div><h1>Order Disputes</h1><p>Dispute records involving this merchant&apos;s order items.</p></div>
        <Link className="merchant-secondary-action" href="/merchant/orders">All orders</Link>
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        {disputes.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead><tr><th>Order</th><th>Reason</th><th>Resolution</th><th>Status</th><th>Opened</th><th>Action</th></tr></thead>
              <tbody>
                {disputes.map((dispute) => (
                  <tr key={dispute.id}>
                    <td><strong>#{dispute.orderId.slice(-8).toUpperCase()}</strong></td>
                    <td>{dispute.reason}</td>
                    <td>{dispute.resolution ?? "—"}</td>
                    <td><span className={`merchant-status is-${dispute.status}`}>{dispute.status}</span></td>
                    <td>{dateFormat.format(dispute.createdAt)}</td>
                    <td><Link className="merchant-table-action" href={`/merchant/orders/${encodeURIComponent(dispute.orderId)}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><MessageCircleWarning size={28} /><strong>No disputes</strong><span>Dispute records involving your items will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
