import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { QuoteHeaderFields, type QuoteHeaderValues } from "@/components/admin/QuoteHeaderFields";
import { isUuid, str, type SP } from "@/lib/admin/params";
import { getSetting, labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { createQuote } from "../actions";

const SERVICE_BY_KIND: Record<string, string> = {
  remodelacion: "remodelacion", administracion: "administracion", legal: "legal", venta_captacion: "venta",
  renta_publicar: "renta", busco_propiedad: "venta",
};

export default async function NewQuote(props: PageProps<"/admin/cotizaciones/nueva">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx("/admin/cotizaciones/nueva");
  const reqId = str(sp, "solicitud");
  const tax = await getSetting<{ label: string | null; rate: number }>(supabase, "quotes.default_tax");
  const v: QuoteHeaderValues = { tax_label: tax?.label ?? null, tax_rate: tax?.rate ?? 0, currency: "DOP", service: "otro" };
  let reqNumber: string | null = null;
  if (isUuid(reqId)) {
    const { data: r } = await supabase.from("service_requests").select("id, number, kind, contact_name, client_user_id, message, details").eq("id", reqId).maybeSingle();
    if (r) {
      reqNumber = r.number as string;
      const d = (r.details ?? {}) as Record<string, unknown>;
      const labels = await userLabels(supabase, [r.client_user_id as string | null]);
      v.client_user_id = (r.client_user_id as string | null) ?? null;
      v.client_label = v.client_user_id ? labelFor(labels, v.client_user_id) : null;
      v.client_name = r.contact_name as string;
      v.service = (typeof d.servicio === "string" ? d.servicio : SERVICE_BY_KIND[r.kind as string]) ?? "otro";
      v.title = typeof d.tipo_trabajo === "string" ? `Cotización: ${d.tipo_trabajo}` : `Cotización para solicitud ${r.number}`;
      v.scope = (typeof d.alcance === "string" ? d.alcance : typeof d.descripcion === "string" ? d.descripcion : (r.message as string | null)) ?? null;
      if (d.moneda === "USD" || d.moneda === "DOP") v.currency = d.moneda;
    }
  }
  return (
    <>
      <PageHeader title="Nueva cotización" back={{ href: reqNumber ? `/admin/solicitudes/${reqId}` : "/admin/cotizaciones", label: reqNumber ? `Solicitud ${reqNumber}` : "Cotizaciones" }} />
      {reqNumber && <p className="alert alert-info small">Datos tomados de la solicitud {reqNumber}. Revíselos antes de guardar.</p>}
      <p className="small muted">Se guarda como borrador. Después podrá agregar partidas y enviarla.</p>
      <ActionForm action={createQuote} submit="Crear borrador">
        {reqNumber && <input type="hidden" name="request_id" value={reqId} />}
        <QuoteHeaderFields v={v} />
      </ActionForm>
    </>
  );
}
