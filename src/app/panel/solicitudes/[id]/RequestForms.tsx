"use client";
import { useActionState, useEffect, useRef } from "react";
import { addRequestComment, startRequestChat } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";

export function CommentForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addRequestComment, idle);
  const ref = useRef<HTMLFormElement>(null);
  const { d } = usePrivateI18n();
  const t = d.panel.request;
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="form">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="field">
        <label htmlFor="req-comment" className="required">{t.addComment}</label>
        <textarea id="req-comment" name="body" className="textarea" required maxLength={4000} aria-describedby="req-comment-hint" />
        <span className="hint" id="req-comment-hint">{t.commentHint}</span>
        <ErrorText state={state} name="body" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={d.common.sending}>{t.addCommentButton}</SubmitButton>
    </form>
  );
}

export function StartChatButton({ requestId }: { requestId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(startRequestChat, idle);
  const t = usePrivateI18n().d.panel.request;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="request_id" value={requestId} />
      <SubmitButton className="btn btn-outline" pendingText={t.openingChat}>{t.chat}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
