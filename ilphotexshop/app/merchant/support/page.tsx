import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import Link from "next/link";
import CreateMerchantSupportTicket from "@/components/merchant/create-support-ticket";
import { getMerchantSupportTickets } from "@/lib/data-access/merchant-portal";

export const metadata: Metadata = { title: "Support Tickets | Merchant portal" };

export default async function MerchantSupportPage() {
  const tickets = await getMerchantSupportTickets();
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Messages & Support</div><h1>Support Tickets</h1><p>Tickets created by or assigned to this merchant account.</p></div></div>
      <section className="merchant-panel merchant-form-panel">
        <div className="merchant-panel-heading"><div><h2>Create support ticket</h2><p>Send a scoped request to ILPhotoX Shop support.</p></div></div>
        <CreateMerchantSupportTicket />
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        {tickets.length ? (
          <div className="merchant-table-wrap">
            <table className="merchant-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Messages</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><strong>{ticket.subject}</strong></td>
                    <td>{ticket.category}</td>
                    <td>{ticket.priority}</td>
                    <td>{ticket.status}</td>
                    <td>{ticket._count.messages}</td>
                    <td>
                      <Link
                        className="merchant-table-action"
                        href={`/merchant/support/${encodeURIComponent(ticket.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="merchant-empty-state"><LifeBuoy size={28} /><strong>No support tickets</strong><span>Your support history will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
