import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Megaphone } from "lucide-react";
import { getSuperAdminAnnouncementHistory } from "@/lib/data-access/super-admin-announcements";
import { getSuperAdminOrderNotifications } from "@/lib/data-access/super-admin-order-notifications";
import OrderNotificationRetryAction from "@/components/super-admin/order-notification-retry-action";

export const metadata: Metadata = {
  title: "Notification Activity | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const audienceLabels = {
  all_users: "All users",
  merchants: "Merchants",
  customers: "Customers",
  admins: "Administrators",
  specific_users: "Specific users",
};

const priorityLabels = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function SuperAdminNotificationActivityPage() {
  const [announcements, orderNotifications] = await Promise.all([
    getSuperAdminAnnouncementHistory(
      "/super-admin/communication/notifications",
    ),
    getSuperAdminOrderNotifications(),
  ]);
  const liveCount = announcements.filter(
    (announcement) => announcement.status === "live",
  ).length;
  const scheduledCount = announcements.filter(
    (announcement) => announcement.status === "scheduled",
  ).length;
  const dismissalCount = announcements.reduce(
    (sum, announcement) => sum + announcement.dismissalCount,
    0,
  );

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / Communication Center / Notifications</div>
          <h1>Notification activity</h1>
          <p>Recent in-app announcement activity recorded by the marketplace.</p>
        </div>
        <Bell aria-hidden="true" size={25} />
      </div>

      <div className="super-admin-data-note" role="note">
        Order emails use SMTP. WhatsApp updates are sent by the WhatsApp Web worker.
        Failed or unconfigured deliveries can be retried here after configuration
        is complete.
      </div>

      <section aria-label="Notification activity summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card">
          <span>Announcements shown</span>
          <strong>{announcements.length}</strong>
        </article>
        <article className="super-admin-summary-card is-approved">
          <span>Live</span>
          <strong>{liveCount}</strong>
        </article>
        <article className="super-admin-summary-card is-pending">
          <span>Scheduled</span>
          <strong>{scheduledCount}</strong>
        </article>
        <article className="super-admin-summary-card">
          <span>User dismissals</span>
          <strong>{dismissalCount}</strong>
        </article>
      </section>

      <section className="super-admin-panel super-admin-audit-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Recent announcement activity</h2>
            <p>Latest {announcements.length} records</p>
          </div>
          <Link
            className="super-admin-primary-action"
            href="/super-admin/communication/announcements"
          >
            <Megaphone aria-hidden="true" size={16} /> Manage announcements
          </Link>
        </div>
        {announcements.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead>
                <tr>
                  <th scope="col">Announcement</th>
                  <th scope="col">Audience</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Schedule (UTC)</th>
                  <th scope="col">Dismissals</th>
                  <th scope="col">Created by</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((announcement) => {
                  const status = announcement.status;
                  return (
                    <tr key={announcement.id}>
                      <td>
                        <strong>{announcement.title}</strong>
                        <span className="super-admin-audit-secondary">
                          {announcement.audience === "specific_users"
                            ? `${announcement.recipientCount} selected accounts`
                            : "Audience evaluated for each signed-in user"}
                        </span>
                      </td>
                      <td>{audienceLabels[announcement.audience]}</td>
                      <td>{priorityLabels[announcement.priority]}</td>
                      <td>
                        <span className={`super-admin-announcement-status is-${status}`}>
                          {status[0].toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {dateFormat.format(announcement.startsAt)} –{" "}
                        {dateFormat.format(announcement.endsAt)}
                      </td>
                      <td>{announcement.dismissalCount}</td>
                      <td>{announcement.createdByName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty">
            <Bell aria-hidden="true" size={26} />
            <strong>No notification activity</strong>
            <span>Create an announcement to begin recording in-app activity.</span>
          </div>
        )}
      </section>

      <section className="super-admin-panel super-admin-audit-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Customer order notifications</h2>
            <p>Latest {orderNotifications.length} delivery records</p>
          </div>
        </div>
        {orderNotifications.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Notification</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {orderNotifications.map((notification) => (
                  <tr key={notification.id}>
                    <td>
                      <Link href="/super-admin/orders">
                        #{notification.orderId.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td>
                      <strong>{notification.title}</strong>
                      {notification.error && (
                        <span className="super-admin-audit-secondary">
                          {notification.error}
                        </span>
                      )}
                    </td>
                    <td>{notification.channel.replace("_", " ")}</td>
                    <td>{notification.recipient ?? "In-app"}</td>
                    <td>{notification.status}</td>
                    <td>{dateFormat.format(notification.createdAt)}</td>
                    <td>
                      {notification.channel !== "in_app" &&
                      (notification.status === "failed" ||
                        notification.status === "unavailable") ? (
                        <OrderNotificationRetryAction id={notification.id} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty">
            <Bell aria-hidden="true" size={26} />
            <strong>No customer order notifications</strong>
            <span>Order notification attempts will appear here.</span>
          </div>
        )}
      </section>
    </div>
  );
}
