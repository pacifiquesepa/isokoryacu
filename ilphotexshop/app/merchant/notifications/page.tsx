import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Notifications | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function MerchantNotificationsPage() {
  const merchant = await requireMerchantPageUser();
  const notifications = await prisma.merchantNotification.findMany({
    where: { merchantId: merchant.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Messages & Support / Notifications</div><h1>Notifications</h1><p>Account and shop activity requiring attention.</p></div>
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        {notifications.length ? (
          <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Notification</th><th>Type</th><th>Received</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td><strong>{notification.title}</strong><small>{notification.message}</small></td>
                <td>{notification.type}</td>
                <td>{dateFormat.format(notification.createdAt)}</td>
                <td><span className={`merchant-status ${notification.readAt ? "is-fulfilled" : "is-pending"}`}>{notification.readAt ? "Read" : "Unread"}</span></td>
                <td>{notification.linkUrl ? <Link className="merchant-table-action" href={notification.linkUrl}>View</Link> : <span className="merchant-list-note">No link</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : (
          <div className="merchant-empty-state"><Bell size={28} /><strong>No notifications</strong><span>Merchant activity notifications will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
