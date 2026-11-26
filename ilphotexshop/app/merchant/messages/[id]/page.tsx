import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMerchantConversationDetail } from "@/lib/data-access/merchant-portal";
import ConversationReply from "@/components/merchant/conversation-reply";

export const metadata: Metadata = { title: "Conversation | Merchant portal" };
const dateFormat = new Intl.DateTimeFormat("en-RW", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function MerchantConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getMerchantConversationDetail(id);
  if (!conversation) notFound();
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div><div className="merchant-breadcrumb">Workspace / Messages / Conversation</div><h1>{conversation.subject}</h1><p>{conversation.status} · {conversation.type} conversation</p></div>
        <Link className="merchant-secondary-action" href="/merchant/messages">All conversations</Link>
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-conversation-thread">
          {conversation.messages.map((message) => (
            <article className="merchant-conversation-message" key={message.id}>
              <strong>{message.sender?.name ?? "User"}</strong>
              <time>{dateFormat.format(message.createdAt)}</time>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
        {conversation.status === "open" ? (
          <ConversationReply conversationId={conversation.id} />
        ) : (
          <div className="merchant-info-banner" role="note">This conversation is closed.</div>
        )}
      </section>
    </div>
  );
}
