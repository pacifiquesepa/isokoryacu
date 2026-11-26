import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { getMerchantAuditData } from "@/lib/data-access/merchant-portal";

export const metadata: Metadata = { title: "Audit Logs | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function MerchantAuditPage() {
  const data = await getMerchantAuditData();
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Audit Logs</div><h1>Audit Logs</h1><p>Account, staff, inventory, login and payout activity for this merchant.</p></div></div>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2><ReceiptText size={18} /> Recent login history</h2></div></div>
        {data.loginEvents.length ? <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Date</th><th>Outcome</th><th>IP</th><th>Device</th><th>Reason</th></tr></thead><tbody>{data.loginEvents.map((event) => <tr key={event.id}><td>{dateFormat.format(event.createdAt)}</td><td>{event.outcome}</td><td>{event.ipAddress}</td><td>{event.deviceName ?? "Unknown"}</td><td>{event.reason ?? "—"}</td></tr>)}</tbody></table></div> : <div className="merchant-empty-state">No login events recorded.</div>}
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2>Staff assignments</h2></div></div>
        {data.staffChanges.length ? <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Updated</th></tr></thead><tbody>{data.staffChanges.map((staff) => <tr key={staff.id}><td><strong>{staff.user.name}</strong><small>{staff.user.email}</small></td><td>{staff.role}</td><td>{staff.status}</td><td>{dateFormat.format(staff.updatedAt)}</td></tr>)}</tbody></table></div> : <div className="merchant-empty-state">No staff activity recorded.</div>}
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div><h2>Staff security audit</h2><p>Immutable assignment and permission activity.</p></div>
        </div>
        {data.staffAudits.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead><tr><th>Time</th><th>Actor</th><th>Target</th><th>Action</th><th>Details</th><th>Result</th></tr></thead>
              <tbody>
                {data.staffAudits.map((audit) => (
                  <tr key={audit.id}>
                    <td>{dateFormat.format(audit.createdAt)}</td>
                    <td><strong>{audit.actor.name}</strong><small>{audit.actor.email}</small></td>
                    <td><strong>{audit.target.name}</strong><small>{audit.target.email}</small></td>
                    <td>{audit.action.replaceAll("_", " ")}</td>
                    <td>{audit.detail}</td>
                    <td><span className={`merchant-status is-${audit.success ? "fulfilled" : "cancelled"}`}>{audit.success ? "Success" : "Failed"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state">No staff security activity recorded.</div>
        )}
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2>Inventory movements</h2></div></div>
        {data.stockMovements.length ? <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Reason</th></tr></thead><tbody>{data.stockMovements.map((movement) => <tr key={movement.id}><td>{dateFormat.format(movement.createdAt)}</td><td>{movement.productName}</td><td>{movement.type}</td><td>{movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}</td><td>{movement.reason}</td></tr>)}</tbody></table></div> : <div className="merchant-empty-state">No inventory movements recorded.</div>}
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2>Financial activity</h2></div></div>
        {data.payoutRequests.length ? <div className="merchant-table-wrap"><table className="merchant-table"><thead><tr><th>Request</th><th>Amount</th><th>Status</th><th>Requested</th></tr></thead><tbody>{data.payoutRequests.map((payout) => <tr key={payout.id}><td>{payout.id.slice(-8).toUpperCase()}</td><td>{payout.amount.toLocaleString("en-RW")} RWF</td><td>{payout.status}</td><td>{dateFormat.format(payout.requestedAt)}</td></tr>)}</tbody></table></div> : <div className="merchant-empty-state">No payout activity recorded.</div>}
      </section>
    </div>
  );
}
