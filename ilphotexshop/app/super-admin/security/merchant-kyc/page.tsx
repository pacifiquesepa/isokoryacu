import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Eye, History, ShieldCheck } from "lucide-react";
import { getSuperAdminMerchantKycAuditLogs } from "@/lib/data-access/merchant-kyc";

export const metadata: Metadata = {
  title: "KYC decision audit | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("en-RW");

export default function MerchantKycAuditPage() {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading KYC audit…</div>}>
      <MerchantKycAuditContent />
    </Suspense>
  );
}

async function MerchantKycAuditContent() {
  const data = await getSuperAdminMerchantKycAuditLogs();
  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / Security / KYC decision audit</div>
          <h1>KYC decision audit</h1>
          <p>Applicant identity and document data are excluded from this audit.</p>
        </div>
        <span className="super-admin-audit-access">
          <ShieldCheck aria-hidden="true" size={17} /> Super-admin only
        </span>
      </div>
      <section aria-label="KYC audit summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card">
          <span>Total KYC actions</span>
          <strong>{numberFormat.format(data.total)}</strong>
        </article>
        <article className="super-admin-summary-card">
          <span>Last 30 days</span>
          <strong>{numberFormat.format(data.recent)}</strong>
        </article>
      </section>
      <section className="super-admin-panel super-admin-audit-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Recent KYC actions</h2>
            <p>Up to 100 latest events · timestamps shown in UTC</p>
          </div>
        </div>
        {data.rows.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead>
                <tr>
                  <th scope="col">Application reference</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Note</th>
                  <th scope="col">Time</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.applicationId}</td>
                    <td>
                      <strong>{row.actorName}</strong>
                      <span className="super-admin-audit-secondary">{row.actorEmail}</span>
                    </td>
                    <td>
                      <span className="super-admin-merchant-access-status">
                        {row.action === "reverification_requested"
                          ? "Re-verification requested"
                          : row.action}
                      </span>
                    </td>
                    <td className="super-admin-audit-reason">
                      {row.reason ?? "—"}
                    </td>
                    <td>{dateFormat.format(row.createdAt)}</td>
                    <td>
                      <Link
                        aria-label={`View KYC audit entry ${row.id}`}
                        className="super-admin-view-action"
                        href={`/super-admin/merchants/kyc/audit/${encodeURIComponent(row.id)}`}
                      >
                        <Eye aria-hidden="true" size={15} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty">
            <History aria-hidden="true" size={26} />
            <strong>No KYC decisions recorded</strong>
            <span>Review actions will appear here.</span>
          </div>
        )}
      </section>
    </div>
  );
}
