import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { z } from "zod";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import SecurityRecordActionButton from "@/components/super-admin/security-record-action";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import { requireCustomerPageUser } from "@/lib/authorization";
import { getAccountSecuritySession } from "@/lib/data-access/super-admin-security";

export const metadata: Metadata = {
  title: "Session details | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const sessionIdSchema = z.string().trim().min(1).max(100);
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function AccountSecuritySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <CustomerPortalLayout active="security">
      <Suspense
        fallback={
          <div className="customer-orders-loading">Loading session details…</div>
        }
      >
        <AccountSecuritySessionContent params={params} />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function AccountSecuritySessionContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const parsedId = sessionIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const user = await requireCustomerPageUser(
    `/account/security/sessions/${encodeURIComponent(id)}`,
  );
  const session = await getAccountSecuritySession(user.id, parsedId.data);
  if (!session) notFound();

  const active = !session.isRevoked && session.expiresAt > new Date();
  const status = active
    ? "Active"
    : session.isRevoked
      ? "Revoked"
      : "Expired";
  const title = `Device session ${session.id.slice(-8).toUpperCase()}`;
  const fields = [
    { label: "Session ID", value: session.id },
    { label: "Device", value: session.deviceName ?? "Unknown device" },
    { label: "IP address", value: session.ipAddress },
    { label: "Status", value: status },
    { label: "Last seen", value: `${dateFormat.format(session.lastSeenAt)} UTC` },
    { label: "Created", value: `${dateFormat.format(session.createdAt)} UTC` },
    { label: "Expires", value: `${dateFormat.format(session.expiresAt)} UTC` },
    ...(session.revokedAt
      ? [{ label: "Revoked", value: `${dateFormat.format(session.revokedAt)} UTC` }]
      : []),
  ];

  return (
    <div className="customer-orders-page customer-security-record-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">
            <Link href="/account/security">Account security</Link> / Session
          </span>
          <h1>{title}</h1>
          <p>Review the device and activity details for this session.</p>
        </div>
        <Link className="customer-orders-back" href="/account/security">
          <ArrowLeft aria-hidden="true" size={16} /> Back to security
        </Link>
      </div>

      <article className="customer-order-record">
        <header className="customer-order-brand">
          <Image
            alt=""
            height={44}
            src="/ilphotox-shop-logo.png"
            width={44}
          />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Customer account · Security record</span>
          </div>
          <span className={`customer-security-status${active ? " is-active" : ""}`}>
            {status}
          </span>
        </header>

        <section className="customer-security-record-content">
          <div className="customer-security-record-icon">
            <ShieldCheck aria-hidden="true" size={24} />
          </div>
          <h2>{session.deviceName ?? "Unknown device"}</h2>
          <p>IP address: {session.ipAddress}</p>
          <dl className="customer-payment-record-details">
            {fields.slice(4).map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          {active && (
            <SecurityRecordActionButton
              action={{
                label: "Revoke this session",
                endpoint: `/api/security/sessions/${encodeURIComponent(session.id)}`,
                method: "DELETE",
              }}
            />
          )}
        </section>

        <section className="customer-order-export">
          <div className="customer-order-section-heading">
            <div>
              <h2>Save or share this record</h2>
              <p>Download or share a protected PDF with a QR code.</p>
            </div>
          </div>
          <SuperAdminRecordActions
            fields={fields}
            recordId={session.id}
            title={title}
          />
        </section>
      </article>
    </div>
  );
}
