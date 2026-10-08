"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markConversationRead, reportMessage, sendMessage } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { downloadHref } from "@/lib/panel/download";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  attachment_name: string | null;
  attachment_mime: string | null;
  created_at: string;
};

type Props = {
  conversationId: string;
  me: string;
  initialMessages: ChatMessage[];
  names: Record<string, string>;
  open: boolean;
  canWrite: boolean;
};

export function ChatRoom({ conversationId, me, initialMessages, names, open, canWrite }: Props) {
  const router = useRouter();
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [realtimeOk, setRealtimeOk] = useState<boolean | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Mensajes del servidor + los recibidos en tiempo real, sin duplicados y en orden.
  const messages = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of initialMessages) map.set(m.id, m);
    for (const m of live) if (!map.has(m.id)) map.set(m.id, m);
    return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [initialMessages, live]);

  // Suscripción en tiempo real a nuevos mensajes de esta conversación (RLS limita lo que llega).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage & { attachment_path?: string | null; hidden?: boolean };
          if (m.hidden) return;
          setLive((prev) => [
            ...prev,
            {
              id: m.id,
              sender_id: m.sender_id,
              body: m.body,
              attachment_name: m.attachment_path ? m.attachment_name : null,
              attachment_mime: m.attachment_path ? m.attachment_mime : null,
              created_at: m.created_at,
            },
          ]);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeOk(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setRealtimeOk(false);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Si el tiempo real no está disponible, se actualiza periódicamente desde el servidor.
  useEffect(() => {
    if (realtimeOk !== false) return;
    const t = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(t);
  }, [realtimeOk, router]);

  // Marca como leída al abrir y al recibir mensajes nuevos.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (canWrite) void markConversationRead(conversationId);
  }, [conversationId, lastId, canWrite]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  return (
    <section className="card" aria-label="Conversación">
      <ol ref={listRef} className="chat" aria-live="polite" aria-relevant="additions" style={{ listStyle: "none", margin: 0 }}>
        {messages.length === 0 ? <li className="empty">Aún no hay mensajes.</li> : null}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <li key={m.id} className={mine ? "bubble mine" : "bubble"}>
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
              {m.attachment_name ? (
                <div className="small" style={{ marginTop: 6 }}>
                  <a href={downloadHref("adjunto", m.id)} style={{ color: "inherit" }}>
                    Adjunto: {m.attachment_name}
                  </a>
                </div>
              ) : null}
              <div className="meta">
                {mine ? "Usted" : names[m.sender_id] ?? "Equipo MAJ"} · {formatDate(m.created_at, true)}
              </div>
              {!mine && canWrite ? <ReportForm messageId={m.id} /> : null}
            </li>
          );
        })}
      </ol>
      <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
        {realtimeOk === false ? <p className="xs muted">Actualización automática cada 20 segundos.</p> : null}
        {!canWrite ? (
          <p className="small muted">Usted no participa en esta conversación.</p>
        ) : open ? (
          <SendForm conversationId={conversationId} onSent={() => router.refresh()} />
        ) : (
          <p className="alert alert-info">Esta conversación está cerrada. Si necesita algo más, inicie una nueva consulta.</p>
        )}
      </div>
    </section>
  );
}

function SendForm({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const f = fd.get("file");
    fd.delete("file");
    if (f instanceof File && f.size > 0) {
      if (!DOC_TYPES.includes(f.type)) return { status: "error", message: "Formato no permitido. Use PDF, JPG, PNG o WebP." };
      try {
        let body: Blob = f;
        let mime = f.type;
        let name = f.name;
        if (IMAGE_TYPES.includes(f.type)) {
          body = (await compressImage(f)).blob;
          mime = "image/webp";
          name = f.name.replace(/\.[^.]+$/, "") + ".webp";
        }
        if (body.size > MAX_DOC_BYTES) return { status: "error", message: "El archivo supera 15 MB." };
        const path = `conversations/${conversationId}/${safeFileName(name)}`;
        const up = await createClient().storage.from("private-docs").upload(path, body, { contentType: mime, upsert: false });
        if (up.error) return { status: "error", message: "No se pudo subir el archivo. El mensaje no se envió." };
        fd.set("attachment_path", path);
        fd.set("attachment_name", name.slice(0, 200));
        fd.set("attachment_mime", mime);
      } catch {
        return { status: "error", message: "No se pudo procesar el archivo. El mensaje no se envió." };
      }
    }
    return sendMessage(prev, fd);
  }, idle);

  const handled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state.status !== "ok" || handled.current === state) return;
    handled.current = state;
    formRef.current?.reset();
    setFile(null);
    setFileKey((k) => k + 1);
    onSent();
  }, [state, onSent]);

  return (
    <form ref={formRef} action={action} className="form">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <div className="field">
        <label htmlFor="chat-body">Mensaje</label>
        <textarea id="chat-body" name="body" className="textarea" maxLength={4000} rows={3} required={!file} />
      </div>
      <div className="field">
        <label htmlFor="chat-file">Adjuntar archivo (opcional)</label>
        <input
          key={fileKey}
          id="chat-file"
          name="file"
          type="file"
          className="input"
          accept={DOC_TYPES.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-describedby="chat-file-hint"
        />
        <span className="hint" id="chat-file-hint">PDF, JPG, PNG o WebP de hasta 15 MB. Solo los participantes pueden verlo.</span>
      </div>
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
    </form>
  );
}

function ReportForm({ messageId }: { messageId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(reportMessage, idle);
  return (
    <details style={{ marginTop: 4 }}>
      <summary className="xs" style={{ cursor: "pointer" }}>Reportar</summary>
      {state.status === "ok" ? (
        <FormMessage state={state} />
      ) : (
        <form action={action} className="stack" style={{ marginTop: 6 }}>
          <input type="hidden" name="message_id" value={messageId} />
          <label htmlFor={`rep-${messageId}`} className="xs">Motivo del reporte</label>
          <textarea id={`rep-${messageId}`} name="reason" className="textarea" required minLength={3} maxLength={1000} rows={2} />
          <FormMessage state={state} />
          <SubmitButton className="btn btn-ghost btn-sm" pendingText="Enviando…">Enviar reporte</SubmitButton>
        </form>
      )}
    </details>
  );
}
