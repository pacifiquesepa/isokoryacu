import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { getMerchantCommunicationData } from "@/lib/data-access/merchant-portal";

export const metadata: Metadata = { title: "Messages | Merchant portal" };

export default async function MerchantMessagesPage() {
  const { conversations } = await getMerchantCommunicationData();
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Messages & Support</div><h1>Conversations</h1><p>Only conversations that include your merchant account.</p></div></div>
      <section className="merchant-panel merchant-dashboard-section">
        {conversations.length ? conversations.map((conversation) => (
          <article className="merchant-panel merchant-dashboard-section" key={conversation.id}>
            <h2>{conversation.subject}</h2>
            <p>{conversation.status} · {conversation._count.messages} messages</p>
            <p>{conversation.participants.map((participant) => participant?.name ?? "Unknown").join(", ")}</p>
            <Link className="merchant-table-action" href={`/merchant/messages/${encodeURIComponent(conversation.id)}`}>View conversation</Link>
          </article>
        )) : (
          <div className="merchant-empty-state"><MessageCircle size={28} /><strong>No conversations yet</strong><span>Merchant conversations from customers or admins will appear here.</span></div>
        )}
      </section>
    </div>
  );
}
