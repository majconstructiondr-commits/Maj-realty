import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { ChatRoom, type ChatMessage } from "./ChatRoom";

export const metadata: Metadata = { title: "Conversación" };

const ROLE_LABEL: Record<string, string> = { cliente: "Cliente", publicador: "Publicador", personal: "Equipo MAJ" };

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

  const names: Record<string, string> = {};
  await Promise.all(
    (participants ?? []).map(async (p) => {
      if (p.user_id === u.id) {
        names[p.user_id] = "Usted";
        return;
      }
      const { data } = await supabase.rpc("public_name", { p_user: p.user_id });
      const role = ROLE_LABEL[p.participant_role] ?? "";
      names[p.user_id] = data ? `${data}${role ? ` (${role})` : ""}` : role || "Participante";
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
      <nav aria-label="Ruta" className="small muted">
        <Link href="/panel/mensajes">Mensajes</Link> / <span aria-current="page">{conv.subject}</span>
      </nav>
      <h1 style={{ margin: 0 }}>{conv.subject}</h1>
      <p className="small muted" style={{ margin: 0 }}>
        {property ? <>Inmueble: <Link href={listingHref(property)}>{property.title} ({property.code})</Link> · </> : null}
        {conv.request_id ? <><Link href={`/panel/solicitudes/${conv.request_id}`}>Ver solicitud</Link> · </> : null}
        Participantes: {Object.values(names).join(", ") || "—"}
      </p>
      <p className="xs muted" style={{ margin: 0 }}>
        Este chat es interno de la página y no está conectado a WhatsApp. No comparta contraseñas ni datos bancarios por este medio.
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
