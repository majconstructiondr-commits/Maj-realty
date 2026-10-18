import Link from "next/link";
import type { SiteSettings } from "@/lib/site";
import { fillTemplate } from "@/lib/whatsapp";
import { es, type Dictionary } from "@/i18n/es";
import { WhatsAppLink } from "./WhatsAppLink";
import { Icon } from "./Icon";

/** `servicio` va en la plantilla de WhatsApp y se mantiene en español (lo lee el equipo de MAJ). */
export function ContactButtons({ s, servicio, formHref = "/contacto", d = es }: { s: SiteSettings; servicio: string; formHref?: string; d?: Dictionary }) {
  return (
    <div className="row">
      <WhatsAppLink number={s["whatsapp.primary"]} text={fillTemplate(s["whatsapp.template"], { servicio })} label={d.whatsapp.write} />
      <a className="btn btn-outline" href={`tel:+1${s["company.primary_phone"].replace(/\D/g, "")}`}>
        <Icon name="phone" size={18} /> {d.whatsapp.call} {s["company.primary_phone"]}
      </a>
      <Link className="btn btn-ghost" href={formHref}>
        <Icon name="mail" size={18} /> {d.whatsapp.sendRequest}
      </Link>
    </div>
  );
}
