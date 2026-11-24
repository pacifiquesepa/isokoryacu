import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getSuperAdminMerchantDetail } from "@/lib/data-access/super-admin-merchant-management";

export const metadata: Metadata = { title: "Merchant Details | ILPhotoX Shop", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function maskDestination(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, "");
  return normalized.length <= 4 ? "••••" : `••••${normalized.slice(-4)}`;
}

function kycActionLabel(action: string) {
  if (action === "reverification_requested") return "Re-verification requested";
  if (action === "approved") return "Approved";
  if (action === "rejected") return "Declined";
  return "Erased";
}

export default async function MerchantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, paramsSearch] = await Promise.all([params, searchParams]);
  const tabValue = Array.isArray(paramsSearch.tab) ? paramsSearch.tab[0] : paramsSearch.tab;
  const tab = ["overview", "business", "location", "products", "orders", "staff", "payments", "earnings", "verification", "audit"].includes(tabValue ?? "") ? tabValue ?? "overview" : "overview";
  const data = await getSuperAdminMerchantDetail(id);
  if (!data) notFound();
  const { merchant, products, orders, accessAudit, kycAudit } = data;
  const tabs = [
    ["overview", "Overview"], ["business", "Business"], ["location", "Location"],
    ["products", "Products"], ["orders", "Orders"], ["staff", "Staff"],
    ["payments", "Payments"], ["earnings", "Earnings"],
    ["verification", "Verification"], ["audit", "Audit History"],
  ];
  return (
    <div className="super-admin-record-detail-page">
      <div className="super-admin-record-detail-heading">
        <div><div className="super-admin-breadcrumb">Workspace / Merchant Management / Merchant Details</div><h1>{merchant.name}</h1><p>{merchant.email} · {merchant.isSuspended ? "Suspended" : "Active"}</p></div>
        <Link className="super-admin-back-action" href="/super-admin/merchants"><ArrowLeft size={16} /> Back to merchants</Link>
      </div>
      <article className="super-admin-panel super-admin-record-detail-panel">
        <header className="super-admin-record-brand"><Image alt="" height={44} src="/ilphotox-shop-logo.png" width={44} /><div><strong>ILPhotoX Shop</strong><span>Super Admin · Merchant details</span></div></header>
        <nav className="super-admin-detail-tabs" aria-label="Merchant detail sections">
          {tabs.map(([value, label]) => <Link aria-current={tab === value ? "page" : undefined} className={tab === value ? "is-active" : ""} href={`/super-admin/merchants/${encodeURIComponent(id)}?tab=${value}`} key={value}>{label}</Link>)}
        </nav>
        {tab === "overview" && <dl className="super-admin-record-fields"><div className="super-admin-record-field"><dt>Full name</dt><dd>{merchant.name}</dd></div><div className="super-admin-record-field"><dt>Email</dt><dd>{merchant.email}</dd></div><div className="super-admin-record-field"><dt>Phone</dt><dd>{merchant.phone ?? "Not provided"}</dd></div><div className="super-admin-record-field"><dt>Account state</dt><dd>{merchant.isAnonymized ? "Anonymized" : merchant.archivedAt ? "Archived" : merchant.isSuspended ? "Suspended" : merchant.isActive ? "Active" : "Inactive"}</dd></div><div className="super-admin-record-field"><dt>Registered</dt><dd>{dateFormat.format(merchant.createdAt)}</dd></div><div className="super-admin-record-field"><dt>Last login</dt><dd>{merchant.lastLoginAt ? dateFormat.format(merchant.lastLoginAt) : "Not recorded"}</dd></div></dl>}
        {tab === "business" && <dl className="super-admin-record-fields"><div className="super-admin-record-field"><dt>Business name</dt><dd>{merchant.merchantKyc?.businessName ?? "Not submitted"}</dd></div><div className="super-admin-record-field"><dt>Owner</dt><dd>{merchant.merchantKyc?.ownerFullName ?? "Not submitted"}</dd></div><div className="super-admin-record-field"><dt>Business address</dt><dd>{merchant.merchantKyc?.businessAddress ?? "Not submitted"}</dd></div><div className="super-admin-record-field"><dt>Tax ID</dt><dd>{merchant.merchantKyc?.taxId ?? "Not provided"}</dd></div></dl>}
        {tab === "location" && <dl className="super-admin-record-fields"><div className="super-admin-record-field"><dt>Submitted location</dt><dd>{merchant.merchantKyc?.businessAddress ?? "Not submitted"}</dd></div><div className="super-admin-record-field"><dt>Map verification</dt><dd>Not available; no geocoding provider is connected.</dd></div></dl>}
        {tab === "products" && <div className="super-admin-detail-list">{products.length ? products.map((product) => <div key={product.id}><strong>{product.name}</strong><span>{product.price.toLocaleString("en-RW")} RWF · stock {product.stockQuantity} · {product.isPublished ? "Published" : "Unpublished"}</span><Link className="super-admin-view-action" href={`/super-admin/records/products/${encodeURIComponent(product.id)}`}><Eye size={15} /> View</Link></div>) : <p>No products submitted.</p>}</div>}
        {tab === "orders" && <div className="super-admin-detail-list">{orders.length ? orders.map((item) => <div key={item.id}><strong>{item.productName}</strong><span>Order #{item.order.id.slice(-8).toUpperCase()} · {item.order.status} · {item.quantity} item(s) · {item.lineTotal.toLocaleString("en-RW")} RWF</span><Link className="super-admin-view-action" href={`/super-admin/records/orders/${encodeURIComponent(item.order.id)}`}><Eye size={15} /> View</Link></div>) : <p>No seller order items recorded.</p>}</div>}
        {tab === "staff" && <div className="super-admin-detail-list">{merchant.merchantStaffMemberships.length ? merchant.merchantStaffMemberships.map((staff) => <div key={staff.id}><strong>{staff.user.name}</strong><span>{staff.user.email} · {staff.role} · {staff.status} · {[staff.canManageProducts ? "Products" : null, staff.canManageOrders ? "Orders" : null, staff.canManageStaff ? "Staff" : null, staff.canManageFinancialProfile ? "Finance" : null].filter(Boolean).join(", ") || "No permissions"}</span></div>) : <p>No merchant staff assignments.</p>}</div>}
        {tab === "payments" && <dl className="super-admin-record-fields"><div className="super-admin-record-field"><dt>Payout destination</dt><dd>{merchant.merchantFinancialProfile ? `${merchant.merchantFinancialProfile.accountName} · ${merchant.merchantFinancialProfile.currency}` : "Not configured"}</dd></div><div className="super-admin-record-field"><dt>Bank</dt><dd>{merchant.merchantFinancialProfile?.bankName ?? "Not provided"} {merchant.merchantFinancialProfile?.bankAccountNumber ? `· ${maskDestination(merchant.merchantFinancialProfile.bankAccountNumber)}` : ""}</dd></div><div className="super-admin-record-field"><dt>Mobile money</dt><dd>{merchant.merchantFinancialProfile?.mobileMoneyProvider ?? "Not provided"} {merchant.merchantFinancialProfile?.mobileMoneyNumber ? `· ${maskDestination(merchant.merchantFinancialProfile.mobileMoneyNumber)}` : ""}</dd></div><div className="super-admin-record-field"><dt>Verification</dt><dd>{merchant.merchantFinancialProfile?.isVerified ? "Verified" : "Unverified"}</dd></div></dl>}
        {tab === "earnings" && <p className="super-admin-data-note" role="note">Merchant earnings and settlement balances are not available: the system has no settlement workflow or approved commission configuration.</p>}
        {tab === "verification" && <dl className="super-admin-record-fields"><div className="super-admin-record-field"><dt>KYC status</dt><dd>{merchant.merchantKyc?.status ?? "Not submitted"}</dd></div><div className="super-admin-record-field"><dt>Submitted</dt><dd>{merchant.merchantKyc?.submittedAt ? dateFormat.format(merchant.merchantKyc.submittedAt) : "Not submitted"}</dd></div><div className="super-admin-record-field"><dt>Reviewed</dt><dd>{merchant.merchantKyc?.reviewedAt ? dateFormat.format(merchant.merchantKyc.reviewedAt) : "Not reviewed"}</dd></div><div className="super-admin-record-field"><dt>Review reason</dt><dd>{merchant.merchantKyc?.reviewReason ?? "No reason recorded"}</dd></div></dl>}
        {tab === "audit" && <div className="super-admin-detail-list">{[...accessAudit.map((row) => ({ id: row.id, label: `${row.action === "suspended" ? "Suspended" : "Reactivated"} by ${row.actor.name}`, detail: row.reason ?? "No reason recorded", date: row.createdAt })), ...kycAudit.map((row) => ({ id: row.id, label: `KYC ${kycActionLabel(row.action)} by ${row.actor.name}`, detail: row.reason ?? "No reason recorded", date: row.createdAt }))].sort((a, b) => b.date.getTime() - a.date.getTime()).map((row) => <div key={row.id}><strong>{row.label}</strong><span>{row.detail}</span><small>{dateFormat.format(row.date)}</small></div>)}</div>}
      </article>
    </div>
  );
}
