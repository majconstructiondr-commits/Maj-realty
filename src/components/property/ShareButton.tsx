"use client";
import { useState } from "react";
import { Icon } from "../ui/Icon";
import { useI18n } from "@/i18n/client";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [msg, setMsg] = useState("");
  const { d } = useI18n();
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg(d.share.copied);
    } catch {
      setMsg(d.share.failed);
    }
  }
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={share}>
        <Icon name="share" size={18} /> {d.share.share}
      </button>
      <span role="status" className="xs muted">{msg}</span>
    </>
  );
}
