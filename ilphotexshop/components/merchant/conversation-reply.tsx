"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ConversationReply({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/seller/messages/${encodeURIComponent(conversationId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error ?? "Reply could not be sent.");
      }
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="merchant-form-grid" onSubmit={submit}>
      <label>Reply<textarea name="body" maxLength={4000} minLength={1} required rows={4} /></label>
      <button className="merchant-primary-action" disabled={busy} type="submit">{busy ? "Sending…" : "Send reply"}</button>
      {error && <p className="merchant-form-error" role="alert">{error}</p>}
    </form>
  );
}
