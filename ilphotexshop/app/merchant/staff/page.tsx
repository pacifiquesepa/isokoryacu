import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import MerchantStaffManager from "@/components/merchant/staff-manager";
import { getMerchantStaffData } from "@/lib/data-access/merchant-staff";
import { requireMerchantWorkspacePermission } from "@/lib/authorization";

export const metadata: Metadata = { title: "Staff Management | Merchant portal" };

export default async function MerchantStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireMerchantWorkspacePermission("canManageStaff");
  return (
    <Suspense fallback={<div className="merchant-loading">Loading staff…</div>}>
      <MerchantStaffContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MerchantStaffContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status =
    rawStatus === "active" || rawStatus === "inactive" ? rawStatus : undefined;
  const data = await getMerchantStaffData(status);

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">Workspace / Staff Management</div>
          <h1>Staff Management</h1>
          <p>Assign account roles and permissions for your shop workspace.</p>
        </div>
      </div>
      <section aria-label="Staff summary" className="merchant-metrics">
        <article className="merchant-metric-card is-blue">
          <span className="merchant-metric-top">All staff</span>
          <strong>{data.total}</strong>
        </article>
        <article className="merchant-metric-card is-green">
          <span className="merchant-metric-top">Active</span>
          <strong>{data.active}</strong>
        </article>
        <article className="merchant-metric-card is-red">
          <span className="merchant-metric-top">Suspended</span>
          <strong>{data.inactive}</strong>
        </article>
      </section>
      <nav aria-label="Filter staff" className="merchant-filter-tabs">
        <Link aria-current={!status ? "page" : undefined} className={!status ? "is-active" : ""} href="/merchant/staff">All staff<span>{data.total}</span></Link>
        <Link aria-current={status === "active" ? "page" : undefined} className={status === "active" ? "is-active" : ""} href="/merchant/staff?status=active">Active<span>{data.active}</span></Link>
        <Link aria-current={status === "inactive" ? "page" : undefined} className={status === "inactive" ? "is-active" : ""} href="/merchant/staff?status=inactive">Suspended<span>{data.inactive}</span></Link>
      </nav>
      {data.rows.length === 0 && data.availableUsers.length === 0 ? (
        <div className="merchant-empty-state">
          <Users aria-hidden="true" size={28} />
          <strong>No staff accounts available</strong>
          <span>Create or activate a user account before assigning merchant staff.</span>
        </div>
      ) : (
        <MerchantStaffManager
          availableUsers={data.availableUsers}
          rows={data.rows}
        />
      )}
    </div>
  );
}
