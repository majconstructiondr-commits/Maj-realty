"use client";
import { useState } from "react";
import { Icon } from "../ui/Icon";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [msg, setMsg] = useState("");
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg("Enlace copiado");
    } catch {
      setMsg("No se pudo compartir. Copie el enlace de la barra de direcciones.");
    }
  }
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={share}>
        <Icon name="share" size={18} /> Compartir
      </button>
      <span role="status" className="xs muted">{msg}</span>
    </>
  );
}
