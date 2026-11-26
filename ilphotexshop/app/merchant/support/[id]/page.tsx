import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMerchantSupportTicketDetail } from "@/lib/data-access/merchant-portal";

export const metadata: Metadata = { title: "Support Ticket | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function MerchantSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getMerchantSupportTicketDetail(id);
  if (!ticket) notFound();
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Support / Ticket</div><h1>{ticket.subject}</h1><p>{ticket.category} · {ticket.priority} · {ticket.status}</p></div>
        <Link className="merchant-secondary-action" href="/merchant/support">All tickets</Link>
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        <p>{ticket.description}</p>
        <div className="merchant-conversation-thread">
          {ticket.messages.map((message) => (
            <article className="merchant-conversation-message" key={message.id}>
              <strong>{message.sender?.name ?? "Support"}</strong>
              <time>{dateFormat.format(message.createdAt)}</time>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
