import type { NextRequest } from "next/server";
import { apiStaff, NO_STORE } from "@/lib/admin/api";
import { toCsv, type CsvValue } from "@/lib/admin/csv";
import { ilikeTerm, isUuid } from "@/lib/admin/params";
import { localDay, localDayStartIso, addDays } from "@/lib/admin/time";
import { createClient } from "@/lib/supabase/server";

// Exportación CSV para el personal (sesión verificada + MFA). Usa el cliente del usuario: RLS aplica.
const MAX_ROWS = 5000;
const KINDS = ["solicitudes", "inmuebles", "licencias", "movimientos"] as const;
type Kind = (typeof KINDS)[number];
type Row = Record<string, unknown>;

const dateOk = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/export/[kind]">) {
  const auth = await apiStaff();
  if ("error" in auth) return auth.error;
  const { kind } = await ctx.params;
  if (!(KINDS as readonly string[]).includes(kind)) return new Response("Tipo de exportación no válido", { status: 404, headers: NO_STORE });
  const q = req.nextUrl.searchParams;
  const supabase = await createClient();

  let headers: string[] = [];
  let rows: CsvValue[][] = [];
  let error: { message?: string } | null = null;

  switch (kind as Kind) {
    case "solicitudes": {
      let query = supabase
        .from("service_requests")
        .select("number, created_at, kind, status, stage, contact_name, contact_email, contact_phone, preferred_channel, property_ref, source, assigned_to, next_action, next_action_at, marketing_consent")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      for (const f of ["kind", "status", "stage"] as const) if (q.get(f)) query = query.eq(f, q.get(f)!);
      const desde = dateOk(q.get("desde"));
      const hasta = dateOk(q.get("hasta"));
      if (desde) query = query.gte("created_at", localDayStartIso(desde));
      if (hasta) query = query.lt("created_at", localDayStartIso(addDays(hasta, 1)));
      const asignado = q.get("asignado") ?? "";
      if (asignado === "ninguno") query = query.is("assigned_to", null);
      else if (isUuid(asignado)) query = query.eq("assigned_to", asignado);
      const term = ilikeTerm(q.get("q") ?? "");
      if (term) query = query.or(`number.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%`);
      const res = await query;
      error = res.error;
      headers = ["Número", "Fecha", "Tipo", "Estado", "Etapa", "Nombre", "Correo", "Teléfono", "Canal", "Referencia inmueble", "Origen", "Responsable (id)", "Próxima acción", "Fecha próxima acción", "Acepta comunicaciones"];
      rows = ((res.data ?? []) as Row[]).map((r) => [
        r.number, r.created_at, r.kind, r.status, r.stage, r.contact_name, r.contact_email, r.contact_phone, r.preferred_channel,
        r.property_ref, r.source, r.assigned_to, r.next_action, r.next_action_at, r.marketing_consent,
      ] as CsvValue[]);
      break;
    }
    case "inmuebles": {
      let query = supabase
        .from("properties")
        .select("code, title, status, operation, property_type, province, municipality, sector, is_maj_listing, is_demo, owner_user_id, published_at, created_at, documents_reviewed_at, property_prices(operation, amount, currency)")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      for (const f of ["status", "operation", "property_type"] as const) if (q.get(f)) query = query.eq(f, q.get(f)!);
      const term = ilikeTerm(q.get("q") ?? "");
      if (term) query = query.or(`code.ilike.%${term}%,title.ilike.%${term}%,sector.ilike.%${term}%`);
      const res = await query;
      error = res.error;
      headers = ["Código", "Título", "Estado", "Operación", "Tipo", "Provincia", "Municipio", "Sector", "Publicación MAJ", "Demostración", "Titular (id)", "Publicado", "Creado", "Documentos revisados", "Precio venta", "Moneda venta", "Precio renta", "Moneda renta"];
      rows = ((res.data ?? []) as Row[]).map((r) => {
        const prices = (r.property_prices ?? []) as Row[];
        const sale = prices.find((p) => p.operation === "venta");
        const rent = prices.find((p) => p.operation === "renta");
        return [
          r.code, r.title, r.status, r.operation, r.property_type, r.province, r.municipality, r.sector, r.is_maj_listing, r.is_demo,
          r.owner_user_id, r.published_at, r.created_at, r.documents_reviewed_at,
          sale?.amount, sale?.currency, rent?.amount, rent?.currency,
        ] as CsvValue[];
      });
      break;
    }
    case "licencias": {
      let query = supabase
        .from("licenses")
        .select("code, status, starts_at, ends_at, active_listing_quota, max_members, holder_user_id, organization_id, status_reason, created_at, plans(code, name), organizations(name)")
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (q.get("status")) query = query.eq("status", q.get("status")!);
      const res = await query;
      error = res.error;
      headers = ["Código", "Estado", "Plan", "Titular (id usuario)", "Organización", "Inicio", "Fin", "Cuota activa", "Miembros", "Motivo de estado", "Creada"];
      rows = ((res.data ?? []) as Row[]).map((r) => {
        const plan = r.plans as Row | null;
        const org = r.organizations as Row | null;
        return [r.code, r.status, plan?.name, r.holder_user_id, org?.name, r.starts_at, r.ends_at, r.active_listing_quota, r.max_members, r.status_reason, r.created_at] as CsvValue[];
      });
      break;
    }
    case "movimientos": {
      let query = supabase
        .from("management_movements")
        .select("movement_date, period, kind, direction, amount, currency, status, description, unit_label, void_reason, contract_id, management_contracts(property_label)")
        .order("movement_date", { ascending: false })
        .limit(MAX_ROWS);
      const contrato = q.get("contrato") ?? "";
      if (isUuid(contrato)) query = query.eq("contract_id", contrato);
      const periodo = q.get("periodo") ?? "";
      if (/^\d{4}-\d{2}$/.test(periodo)) query = query.eq("period", periodo);
      if (q.get("moneda") === "DOP" || q.get("moneda") === "USD") query = query.eq("currency", q.get("moneda")!);
      const res = await query;
      error = res.error;
      headers = ["Fecha", "Período", "Inmueble", "Tipo", "Dirección", "Monto", "Moneda", "Estado", "Descripción", "Unidad", "Motivo de anulación"];
      rows = ((res.data ?? []) as Row[]).map((r) => {
        const c = r.management_contracts as Row | null;
        return [r.movement_date, r.period, c?.property_label, r.kind, r.direction, r.amount, r.currency, r.status, r.description, r.unit_label, r.void_reason] as CsvValue[];
      });
      break;
    }
  }

  if (error) return new Response("No se pudo generar la exportación", { status: 500, headers: NO_STORE });
  const body = "﻿" + toCsv(headers, rows);
  const filename = `maj-${kind}-${localDay(new Date())}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
