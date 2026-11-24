import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import { getSuperAdminMerchantKycAuditDetail } from "@/lib/data-access/merchant-kyc";
import { merchantKycIdSchema } from "@/lib/validation/merchant-kyc";

export const metadata: Metadata = {
  title: "Merchant KYC decision | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function MerchantKycAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading audit entry…</div>}>
      <MerchantKycAuditDetailContent params={params} />
    </Suspense>
  );
}

async function MerchantKycAuditDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsedId = merchantKycIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const entry = await getSuperAdminMerchantKycAuditDetail(parsedId.data);
  if (!entry) notFound();
  const actionLabel =
    entry.action === "reverification_requested"
      ? "Re-verification requested"
      : `Merchant KYC ${entry.action}`;
  const title = actionLabel;
  const fields = [
    { label: "Audit entry ID", value: entry.id },
    { label: "Action", value: actionLabel },
    { label: "Application reference", value: entry.applicationId },
    {
      label: "Applicant information",
      value:
        entry.action === "rejected"
          ? "Removed after the application was declined"
          : entry.action === "erased"
            ? "Removed during account anonymization"
            : "Not included in audit records",
    },
    { label: "Reviewed by", value: entry.actorName },
    { label: "Reviewer email", value: entry.actorEmail },
    { label: "Reason", value: entry.reason ?? "No note recorded" },
    { label: "Recorded at (UTC)", value: dateFormat.format(entry.createdAt) },
  ];

  return (
    <div className="super-admin-record-detail-page">
      <div className="super-admin-record-detail-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / Merchant Management / KYC audit</div>
          <h1>{title}</h1>
          <p>Applicant identity and document data are not stored in the audit log.</p>
        </div>
        <Link className="super-admin-back-action" href="/super-admin/security/merchant-kyc">
          <ArrowLeft size={16} /> KYC audit log
        </Link>
      </div>
      <article className="super-admin-panel super-admin-record-detail-panel">
        <header className="super-admin-record-brand">
          <Image alt="" height={44} src="/ilphotox-shop-logo.png" width={44} />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Super Admin · KYC decision audit record</span>
          </div>
        </header>
        <dl className="super-admin-record-fields">
          {fields.map((field) => (
            <div className="super-admin-record-field" key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
        <SuperAdminRecordActions fields={fields} recordId={entry.id} title={title} />
      </article>
    </div>
  );
}
