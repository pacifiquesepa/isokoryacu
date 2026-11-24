import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import OrderWorkflowActions from "@/components/super-admin/order-workflow-actions";
import { getSuperAdminRecordDetails } from "@/lib/data-access/super-admin-records";

export const metadata: Metadata = {
  title: "Record details | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

type SuperAdminRecordPageProps = {
  params: Promise<{ kind: string; id: string }>;
};

export default function SuperAdminRecordPage({
  params,
}: SuperAdminRecordPageProps) {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading record…</div>}>
      <RecordDetails params={params} />
    </Suspense>
  );
}

async function RecordDetails({ params }: SuperAdminRecordPageProps) {
  const { kind, id } = await params;
  const record = await getSuperAdminRecordDetails(kind, id);
  if (!record) notFound();

  const listPath =
    record.kind === "users"
      ? "/super-admin/users"
      : record.kind === "products"
        ? "/super-admin/products"
        : "/super-admin/orders";

  return (
    <div className="super-admin-record-detail-page">
      <div className="super-admin-record-detail-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / {record.kind} / Record details</div>
          <h1>{record.title}</h1>
          <p>{record.subtitle}</p>
        </div>
        <Link className="super-admin-back-action" href={listPath}>
          <ArrowLeft size={16} />
          Back to records
        </Link>
      </div>

      <article className="super-admin-panel super-admin-record-detail-panel">
        <header className="super-admin-record-brand">
          <Image
            alt=""
            height={44}
            src="/ilphotox-shop-logo.png"
            width={44}
          />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Super Admin · Record details</span>
          </div>
        </header>

        <dl className="super-admin-record-fields">
          {record.fields.map((field) => (
            <div className="super-admin-record-field" key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>

        {record.kind === "orders" && (
          <div className="super-admin-detail-actions">
            <OrderWorkflowActions
              orderId={record.id}
              status={record.fields.find((field) => field.label === "Status")?.value ?? ""}
              paymentMode={record.fields.find((field) => field.label === "Payment method")?.value}
              cashCollected={record.fields.find((field) => field.label === "Cash collection")?.value !== "Not recorded"}
            />
          </div>
        )}

        <SuperAdminRecordActions
          fields={record.fields}
          recordId={record.id}
          title={record.title}
        />
      </article>
    </div>
  );
}
