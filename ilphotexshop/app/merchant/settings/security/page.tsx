import type { Metadata } from "next";
import { Suspense } from "react";
import TwoFactorSettings from "@/components/account/two-factor-settings";
import { requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getAccountSecuritySessions } from "@/lib/data-access/super-admin-security";

export const metadata: Metadata = { title: "Security | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default function MerchantSecurityPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading security…</div>}>
      <MerchantSecurityContent />
    </Suspense>
  );
}

async function MerchantSecurityContent() {
  const merchant = await requireMerchantPageUser();
  const [account, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: merchant.id }, select: { twoFactorEnabled: true } }),
    getAccountSecuritySessions(merchant.id),
  ]);
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Settings / Security</div><h1>Account Security</h1><p>Manage two-factor authentication and active sessions.</p></div></div>
      <section className="merchant-panel merchant-form-panel">
        <TwoFactorSettings enabled={account?.twoFactorEnabled ?? false} />
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2>Devices & sessions</h2><p>{sessions.filter((session) => !session.isRevoked && session.expiresAt > new Date()).length} active</p></div></div>
        {sessions.length ? <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Device</th><th>IP address</th><th>Last seen</th><th>Status</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{session.deviceName ?? "Unknown device"}</td><td>{session.ipAddress}</td><td>{dateFormat.format(session.lastSeenAt)}</td><td>{session.isRevoked ? "Revoked" : session.expiresAt > new Date() ? "Active" : "Expired"}</td></tr>)}</tbody></table></div> : <div className="merchant-empty-state">No recorded sessions yet.</div>}
      </section>
    </div>
  );
}
