import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2, CreditCard, Smartphone } from "lucide-react";
import { PaymentAccountType } from "@prisma/client";
import SuperAdminPaymentAccountForm from "@/components/super-admin/payment-account-form";
import SuperAdminPaymentAccountStatusAction from "@/components/super-admin/payment-account-status-action";
import { getSuperAdminPaymentAccounts } from "@/lib/data-access/super-admin-payment-accounts";

export const metadata: Metadata = {
  title: "Payment Accounts | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeZone: "UTC",
});

type SuperAdminPaymentAccountsPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default function SuperAdminPaymentAccountsPage({
  searchParams,
}: SuperAdminPaymentAccountsPageProps) {
  return (
    <Suspense
      fallback={<div className="super-admin-loading">Loading payment accounts…</div>}
    >
      <SuperAdminPaymentAccountsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SuperAdminPaymentAccountsContent({
  searchParams,
}: SuperAdminPaymentAccountsPageProps) {
  const params = await searchParams;
  const type =
    params.type === PaymentAccountType.mobile_money
      ? PaymentAccountType.mobile_money
      : PaymentAccountType.bank;
  const accountTypeLabel =
    type === PaymentAccountType.bank ? "Bank" : "Mobile money";
  const AccountIcon =
    type === PaymentAccountType.bank ? Building2 : Smartphone;
  const accounts = await getSuperAdminPaymentAccounts(type);
  const activeCount = accounts.filter((account) => account.isActive).length;

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">
            Workspace / Payment Management / {accountTypeLabel} Accounts
          </div>
          <h1>{accountTypeLabel} accounts</h1>
          <p>Configure {accountTypeLabel.toLowerCase()} destinations for customer payment instructions.</p>
        </div>
        <AccountIcon aria-hidden="true" size={25} />
      </div>

      <div className="super-admin-data-note" role="note">
        These account settings do not process or verify payments. Do not share
        account numbers beyond the intended customer payment instructions. Customers
        see active destinations only.
      </div>

      <section aria-label="Payment account summary" className="super-admin-records-summary">
        <article className="super-admin-summary-card">
          <span>Configured {accountTypeLabel.toLowerCase()} accounts</span>
          <strong>{accounts.length.toLocaleString("en-RW")}</strong>
        </article>
        <article className="super-admin-summary-card">
          <span>Active {accountTypeLabel.toLowerCase()} accounts</span>
          <strong>{activeCount.toLocaleString("en-RW")}</strong>
        </article>
      </section>

      <section className="super-admin-panel super-admin-profile-edit-panel">
        <div className="super-admin-panel-heading">
          <div>
            <h2>Add a {accountTypeLabel.toLowerCase()} account</h2>
            <p>Destination details used for customer payment instructions.</p>
          </div>
        </div>
        <SuperAdminPaymentAccountForm type={type} />
      </section>

      <section className="super-admin-panel super-admin-audit-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>Configured {accountTypeLabel.toLowerCase()} accounts</h2>
            <p>{accounts.length.toLocaleString("en-RW")} accounts</p>
          </div>
        </div>
        {accounts.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Account name</th>
                  <th scope="col">Account number</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Status</th>
                  <th scope="col">Added</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const Icon =
                    account.type === "bank" ? Building2 : Smartphone;
                  return (
                    <tr key={account.id}>
                      <td>
                        <span className="super-admin-payment-account-type">
                          <Icon aria-hidden="true" size={15} />
                          {account.type === "bank" ? "Bank" : "Mobile money"}
                        </span>
                      </td>
                      <td>{account.provider}</td>
                      <td><strong>{account.accountName}</strong></td>
                      <td><code>{account.accountNumber}</code></td>
                      <td>{account.currency}</td>
                      <td>
                        <span
                          className={`super-admin-merchant-access-status${account.isActive ? "" : " is-suspended"}`}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{dateFormat.format(account.createdAt)}</td>
                      <td>
                        <SuperAdminPaymentAccountStatusAction
                          id={account.id}
                          isActive={account.isActive}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty">
            <CreditCard aria-hidden="true" size={25} />
            <strong>No {accountTypeLabel.toLowerCase()} accounts configured</strong>
            <span>Add a {accountTypeLabel.toLowerCase()} account to configure the marketplace.</span>
          </div>
        )}
      </section>
    </div>
  );
}
