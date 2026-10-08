import Link from "next/link";
import type { SiteSettings } from "@/lib/site";
import { fillTemplate } from "@/lib/whatsapp";
import { WhatsAppLink } from "./WhatsAppLink";
import { Icon } from "./Icon";

export function ContactButtons({ s, servicio, formHref = "/contacto" }: { s: SiteSettings; servicio: string; formHref?: string }) {
  return (
    <div className="row">
      <WhatsAppLink number={s["whatsapp.primary"]} text={fillTemplate(s["whatsapp.template"], { servicio })} label="Escribir por WhatsApp" />
      <a className="btn btn-outline" href={`tel:+1${s["company.primary_phone"].replace(/\D/g, "")}`}>
        <Icon name="phone" size={18} /> Llamar {s["company.primary_phone"]}
      </a>
      <Link className="btn btn-ghost" href={formHref}>
        <Icon name="mail" size={18} /> Enviar solicitud
      </Link>
    </div>
  );
}
