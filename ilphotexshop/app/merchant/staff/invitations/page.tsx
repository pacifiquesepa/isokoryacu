import type { Metadata } from "next";
import Link from "next/link";
import { MailPlus } from "lucide-react";
import { requireMerchantWorkspacePermission, requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import CancelStaffInvitation from "@/components/merchant/cancel-staff-invitation";
import CreateStaffInvitation from "@/components/merchant/create-staff-invitation";

export const metadata: Metadata = { title: "Staff Invitations | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeZone: "UTC" });

export default async function MerchantStaffInvitationsPage() {
  await requireMerchantWorkspacePermission("canManageStaff");
  const merchant = await requireMerchantPageUser();
  await prisma.staffInvitation.updateMany({
    where: { merchantId: merchant.id, status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
  const invitations = await prisma.staffInvitation.findMany({
    where: { merchantId: merchant.id },
    select: { id: true, name: true, email: true, merchantRole: true, status: true, expiresAt: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Staff / Invitations</div><h1>Staff Invitations</h1><p>Create, review and cancel secure merchant staff invitations.</p></div>
        <Link className="merchant-primary-action" href="/merchant/staff">Manage staff</Link>
      </div>
      <section className="merchant-panel merchant-form-panel">
        <div className="merchant-panel-heading">
          <div><h2>Create invitation</h2><p>Creates a 7-day, single-use staff acceptance link.</p></div>
        </div>
        <CreateStaffInvitation />
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        {invitations.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead><tr><th>Invitee</th><th>Role</th><th>Status</th><th>Expires</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td><strong>{invitation.name}</strong><small>{invitation.email}</small></td>
                    <td>{invitation.merchantRole ?? "—"}</td>
                    <td><span className={`merchant-status is-${invitation.status}`}>{invitation.status}</span></td>
                    <td>{dateFormat.format(invitation.expiresAt)}</td>
                    <td>{dateFormat.format(invitation.createdAt)}</td>
                    <td>{invitation.status === "pending" ? <CancelStaffInvitation id={invitation.id} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><MailPlus size={28} /><strong>No invitations</strong><span>Merchant staff invitations will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
