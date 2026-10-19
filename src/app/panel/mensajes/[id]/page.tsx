import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { ChatRoom, type ChatMessage } from "./ChatRoom";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.conversation.meta };
}

export default async function Page(props: PageProps<"/panel/mensajes/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const u = await requireUser(`/panel/mensajes/${id}`);
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, subject, status, property_id, request_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const [{ data: participants }, { data: msgs }, { data: property }] = await Promise.all([
    supabase.from("conversation_participants").select("user_id, participant_role").eq("conversation_id", id),
    supabase
      .from("messages")
      .select("id, sender_id, body, attachment_path, attachment_name, attachment_mime, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    conv.property_id ? supabase.from("catalog").select("code, slug, title").eq("id", conv.property_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const isParticipant = (participants ?? []).some((p) => p.user_id === u.id);
  const { d } = await getI18n();
  const t = d.panel.conversation;
  const ROLE_LABEL = t.roles;

  const names: Record<string, string> = {};
  await Promise.all(
    (participants ?? []).map(async (p) => {
      if (p.user_id === u.id) {
        names[p.user_id] = d.panel.shared.you;
        return;
      }
      const { data } = await supabase.rpc("public_name", { p_user: p.user_id });
      const role = ROLE_LABEL[p.participant_role] ?? "";
      names[p.user_id] = data ? `${data}${role ? ` (${role})` : ""}` : role || d.panel.shared.participant;
    }),
  );

  const messages: ChatMessage[] = (msgs ?? []).reverse().map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    body: m.body,
    attachment_name: m.attachment_path ? m.attachment_name : null,
    attachment_mime: m.attachment_path ? m.attachment_mime : null,
    created_at: m.created_at,
  }));

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted">
        <Link href="/panel/mensajes">{d.panel.messages.title}</Link> / <span aria-current="page">{conv.subject}</span>
      </nav>
      <h1 style={{ margin: 0 }}>{conv.subject}</h1>
      <p className="small muted" style={{ margin: 0 }}>
        {property ? <>{d.panel.shared.propertyLabel} <Link href={listingHref(property)}>{property.title} ({property.code})</Link> · </> : null}
        {conv.request_id ? <><Link href={`/panel/solicitudes/${conv.request_id}`}>{d.panel.shared.viewRequest}</Link> · </> : null}
        {fmt(t.participants, { names: Object.values(names).join(", ") || "—" })}
      </p>
      <p className="xs muted" style={{ margin: 0 }}>
        {t.notWhatsapp}
      </p>
      <ChatRoom
        conversationId={conv.id}
        me={u.id}
        initialMessages={messages}
        names={names}
        open={conv.status === "abierta"}
        canWrite={isParticipant}
      />
    </div>
  );
}
