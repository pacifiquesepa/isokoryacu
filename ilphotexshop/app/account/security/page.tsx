import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Eye, ShieldCheck } from "lucide-react";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import TwoFactorSettings from "@/components/account/two-factor-settings";
import SecurityRecordActionButton from "@/components/super-admin/security-record-action";
import { requireCustomerPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getAccountSecuritySessions } from "@/lib/data-access/super-admin-security";

export const metadata: Metadata = {
  title: "Account security | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function AccountSecurityPage() {
  return (
    <CustomerPortalLayout active="security">
      <Suspense
        fallback={
          <div className="customer-orders-loading">Loading account security…</div>
        }
      >
        <AccountSecurityContent />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function AccountSecurityContent() {
  await connection();
  const user = await requireCustomerPageUser("/account/security");
  const now = new Date();
  const [account, sessions, activeSessionCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    }),
    getAccountSecuritySessions(user.id),
    prisma.securitySession.count({
      where: {
        userId: user.id,
        isRevoked: false,
        expiresAt: { gt: now },
      },
    }),
  ]);

  return (
    <div className="customer-orders-page customer-security-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">Account / Security</span>
          <h1>Account security</h1>
          <p>Manage sign-in protection and review the devices using your account.</p>
        </div>
      </div>

      <section className="customer-security-card">
        <div className="customer-security-section-heading has-icon">
          <span className="customer-security-icon">
            <ShieldCheck aria-hidden="true" size={19} />
          </span>
          <div>
            <h2>Two-factor authentication</h2>
            <p>Add an authenticator app as an extra sign-in check.</p>
          </div>
        </div>
        <TwoFactorSettings enabled={account?.twoFactorEnabled ?? false} />
      </section>

      <section className="customer-security-card">
        <div className="customer-security-section-heading">
          <div>
            <h2>Devices &amp; sessions</h2>
            <p>Review recent sign-ins and revoke sessions you do not recognize.</p>
          </div>
          <span className="customer-security-count">
            {activeSessionCount} active
          </span>
        </div>
        {sessions.length ? (
          <div className="customer-orders-table-wrap">
            <table className="customer-orders-table customer-security-table">
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">IP address</th>
                  <th scope="col">Last seen (UTC)</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const active = !session.isRevoked && session.expiresAt > now;
                  return (
                    <tr key={session.id}>
                      <td><strong>{session.deviceName ?? "Unknown device"}</strong></td>
                      <td>{session.ipAddress}</td>
                      <td>{dateFormat.format(session.lastSeenAt)}</td>
                      <td>
                        <span className={`customer-security-status${active ? " is-active" : ""}`}>
                          {active
                            ? "Active"
                            : session.isRevoked
                              ? "Revoked"
                              : "Expired"}
                        </span>
                      </td>
                      <td>
                        <div className="customer-security-actions">
                          <Link
                            aria-label={`View ${session.deviceName ?? "session"} details`}
                            className="customer-order-view"
                            href={`/account/security/sessions/${encodeURIComponent(session.id)}`}
                          >
                            <Eye aria-hidden="true" size={15} /> View
                          </Link>
                          {active && (
                            <SecurityRecordActionButton
                              action={{
                                label: "Revoke",
                                endpoint: `/api/security/sessions/${encodeURIComponent(session.id)}`,
                                method: "DELETE",
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="customer-security-empty">
            No recorded sessions yet. Sessions will appear after you sign in.
          </div>
        )}
      </section>
    </div>
  );
}
