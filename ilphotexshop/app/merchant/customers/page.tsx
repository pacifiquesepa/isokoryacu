import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getMerchantCustomers } from "@/lib/data-access/merchant-portal";

export const metadata: Metadata = { title: "Customers | Merchant portal" };
const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeZone: "UTC" });

export default async function MerchantCustomersPage() {
  const customers = await getMerchantCustomers();
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Customers</div><h1>My Customers</h1><p>Customers who purchased one or more of your products.</p></div></div>
      <section className="merchant-panel merchant-dashboard-section">
        {customers.length ? (
          <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Units</th><th>Total purchases</th><th>Last purchase</th></tr></thead><tbody>{customers.map((customer) => (
            <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.email}</small></td><td>{customer.phone ?? "Not provided"}</td><td>{numberFormat.format(customer.orders)}</td><td>{numberFormat.format(customer.units)}</td><td>{numberFormat.format(customer.purchases)} RWF</td><td>{dateFormat.format(customer.lastPurchase)}</td></tr>
          ))}</tbody></table></div>
        ) : (
          <div className="merchant-empty-state"><Users size={28} /><strong>No customers yet</strong><span>Customers will appear after they purchase your products.</span></div>
        )}
      </section>
    </div>
  );
}
