"use client";
import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toggleFavorite } from "@/app/actions/listing";
import { Icon } from "../ui/Icon";
import { useI18n } from "@/i18n/client";

export function FavoriteButton({ propertyId, initial }: { propertyId: string; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const path = usePathname();
  const { d } = useI18n();
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        aria-pressed={fav}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleFavorite(propertyId, path);
            if (r?.ok) setFav(Boolean(r.favorite));
            else if (r?.message) setMsg(r.message);
          })
        }
      >
        <Icon name="heart" size={18} /> {fav ? d.share.inFavorites : d.share.saveFavorite}
      </button>
      {msg ? <span role="status" className="xs muted">{msg}</span> : null}
    </>
  );
}
