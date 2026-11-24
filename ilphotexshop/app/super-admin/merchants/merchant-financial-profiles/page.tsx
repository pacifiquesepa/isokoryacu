import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Search, WalletCards } from "lucide-react";
import { AddMerchantFinancialProfile, SetFinancialVerified } from "@/components/super-admin/merchant-management-actions";
import { getMerchantFinancialProfiles, getMerchantStaffOptions, MERCHANT_MANAGEMENT_PAGE_SIZE } from "@/lib/data-access/super-admin-merchant-management";

export const metadata: Metadata = { title: "Merchant Financial Profiles | ILPhotoX Shop", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeZone: "UTC" });

function maskDestination(value: string | null) {
  if (!value) return "Not provided";
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length <= 4) return "••••";
  return `••••${normalized.slice(-4)}`;
}

export default async function MerchantFinancialProfilesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);
  const pageValue = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(pageValue ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 500) : 1;
  const [data, options] = await Promise.all([getMerchantFinancialProfiles(query, page), getMerchantStaffOptions()]);
  const pageCount = Math.max(1, Math.ceil(data.total / MERCHANT_MANAGEMENT_PAGE_SIZE));
  if (page > pageCount) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    search.set("page", String(pageCount));
    redirect(`/super-admin/merchants/merchant-financial-profiles?${search.toString()}`);
  }
  function pageHref(nextPage: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    search.set("page", String(nextPage));
    return `/super-admin/merchants/merchant-financial-profiles?${search.toString()}`;
  }
  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading"><div><div className="super-admin-breadcrumb">Workspace / Merchant Management / Merchant Financial Profiles</div><h1>Merchant Financial Profiles</h1><p>Store and review merchant payout destinations.</p></div><WalletCards aria-hidden="true" size={25} /></div>
      <p className="super-admin-data-note" role="note">Profiles store verified payout destinations. Process merchant requests from <Link href="/super-admin/payments/merchant-payouts">Merchant Payouts</Link> and review merchant-submitted account changes from <Link href="/super-admin/merchants/financial-change-requests">Payout Account Change Requests</Link>.</p>
      <section aria-label="Financial profile summary" className="super-admin-records-summary"><article className="super-admin-summary-card is-active"><span>Profiles</span><strong>{data.total.toLocaleString("en-RW")}</strong></article><article className="super-admin-summary-card"><span>Verified</span><strong>{data.verified.toLocaleString("en-RW")}</strong></article><article className="super-admin-summary-card"><span>Unverified</span><strong>{data.unverified.toLocaleString("en-RW")}</strong></article></section>
      <section className="super-admin-panel super-admin-announcement-create-panel"><div className="super-admin-panel-heading"><div><h2>Add or replace profile</h2><p>Use the merchant&apos;s registered payout destination</p></div></div><AddMerchantFinancialProfile merchants={options.merchants} /></section>
      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar"><div><h2>Financial records</h2><p>{data.total.toLocaleString("en-RW")} matching profiles</p></div><form action="/super-admin/merchants/merchant-financial-profiles" className="super-admin-record-search" role="search"><Search aria-hidden="true" size={17} /><input aria-label="Search financial profiles" defaultValue={query} maxLength={100} name="q" placeholder="Search merchant or account" type="search" /><button type="submit">Search</button></form></div>
        {data.rows.length ? <>
          <div className="super-admin-records-table-wrap"><table className="super-admin-records-table"><thead><tr><th>Merchant</th><th>Account</th><th>Bank</th><th>Mobile money</th><th>Currency</th><th>Verification</th><th>Action</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td><strong>{row.merchant.name}</strong><span className="super-admin-audit-secondary">{row.merchant.email}</span></td><td>{row.accountName}</td><td>{row.bankName ? <><strong>{row.bankName}</strong><span className="super-admin-audit-secondary">{maskDestination(row.bankAccountNumber)}</span></> : "Not provided"}</td><td>{row.mobileMoneyProvider ? <><strong>{row.mobileMoneyProvider}</strong><span className="super-admin-audit-secondary">{maskDestination(row.mobileMoneyNumber)}</span></> : "Not provided"}</td><td>{row.currency}</td><td><span className={`super-admin-status${row.isVerified ? " is-confirmed" : " is-pending"}`}>{row.isVerified ? `Verified${row.verifiedAt ? ` · ${dateFormat.format(row.verifiedAt)}` : ""}` : "Unverified"}</span></td><td><SetFinancialVerified id={row.id} isVerified={row.isVerified} /></td></tr>)}</tbody></table></div>
          {data.total > data.pageSize && <nav aria-label="Merchant financial profile pagination" className="super-admin-pagination"><span>Page {data.page} of {pageCount}</span><div>{data.page > 1 ? <Link className="super-admin-back-action" href={pageHref(data.page - 1)}><ArrowLeft size={15} /> Previous</Link> : <span className="super-admin-page-disabled">Previous</span>} {data.page < pageCount ? <Link className="super-admin-primary-action" href={pageHref(data.page + 1)}>Next <ArrowRight size={15} /></Link> : <span className="super-admin-page-disabled">Next</span>}</div></nav>}
        </> : <div className="super-admin-records-empty"><WalletCards size={26} /><strong>No merchant financial profiles</strong><span>Add the first profile using the form above.</span></div>}
      </section>
    </div>
  );
}
