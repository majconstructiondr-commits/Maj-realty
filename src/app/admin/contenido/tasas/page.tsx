import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Pagination } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { pageOf, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { localDay } from "@/lib/admin/time";
import { formatDate, formatNumber } from "@/lib/format";
import { addExchangeRate, deleteExchangeRate } from "../actions";

type Rate = { id: string; base: string; quote: string; rate: number; source: string; rate_date: string; entered_by: string | null; created_at: string };

export default async function AdminRates(props: PageProps<"/admin/contenido/tasas">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx("/admin/contenido/tasas");
  const { page, pageSize, from, to } = pageOf(sp);
  const { data, count, error } = await supabase.from("exchange_rates").select("*", { count: "exact" }).order("rate_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  const rows = (data ?? []) as Rate[];
  const people = await userLabels(supabase, rows.map((r) => r.entered_by));
  return (
    <>
      <PageHeader title="Contenido y portafolio" />
      <ContentTabs current="/admin/contenido/tasas" />
      <p className="small muted">Las conversiones del sitio son orientativas y usan la tasa más reciente registrada aquí, con su fuente y fecha. Nunca invente una tasa: cópiela de una fuente verificable.</p>
      <section className="card card-body" style={{ marginBottom: 16 }}>
        <ActionForm action={addExchangeRate} submit="Registrar tasa" resetOnSuccess>
          <div className="form-grid">
            <div className="field"><label htmlFor="r-b">Moneda base</label><select id="r-b" name="base" className="select" defaultValue="USD"><option value="USD">USD</option><option value="DOP">DOP</option></select></div>
            <div className="field"><label htmlFor="r-q">Moneda cotizada</label><select id="r-q" name="quote" className="select" defaultValue="DOP"><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
            <div className="field"><label htmlFor="r-r" className="required">Tasa (1 base = X cotizada)</label><input id="r-r" name="rate" type="number" min="0.000001" step="0.000001" className="input" required /></div>
            <div className="field"><label htmlFor="r-d" className="required">Fecha de la tasa</label><input id="r-d" name="rate_date" type="date" className="input" required defaultValue={localDay(new Date())} /></div>
            <div className="field"><label htmlFor="r-s" className="required">Fuente</label><input id="r-s" name="source" className="input" required minLength={2} maxLength={200} placeholder="Banco Central de la República Dominicana" /></div>
          </div>
        </ActionForm>
      </section>
      {error && <p className="alert alert-error">No se pudieron cargar las tasas.</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Par</th><th>Tasa</th><th>Fuente</th><th>Registrada por</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Sin tasas registradas: el sitio no mostrará conversiones.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.rate_date)}</td>
                <td>1 {r.base} = {r.quote}</td>
                <td>{formatNumber(r.rate, 6)}</td>
                <td className="small">{r.source}</td>
                <td className="small">{labelFor(people, r.entered_by)} · {formatDate(r.created_at, true)}</td>
                <td>
                  <ActionForm action={deleteExchangeRate} submit="Eliminar" buttonClass="btn btn-ghost btn-sm" confirm="¿Eliminar este registro (p. ej. por error de digitación)?">
                    <input type="hidden" name="id" value={r.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination base="/admin/contenido/tasas" sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
