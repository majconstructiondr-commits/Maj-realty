import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Pagination } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { pageOf, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { localDay } from "@/lib/admin/time";
import { formatDate, formatNumber } from "@/lib/format";
import { addExchangeRate, deleteExchangeRate } from "../actions";
import { getI18n } from "@/i18n/server";

type Rate = { id: string; base: string; quote: string; rate: number; source: string; rate_date: string; entered_by: string | null; created_at: string };

export default async function AdminRates(props: PageProps<"/admin/contenido/tasas">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx("/admin/contenido/tasas");
  const t = (await getI18n()).d.admin.content;
  const { page, pageSize, from, to } = pageOf(sp);
  const { data, count, error } = await supabase.from("exchange_rates").select("*", { count: "exact" }).order("rate_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  const rows = (data ?? []) as Rate[];
  const people = await userLabels(supabase, rows.map((r) => r.entered_by));
  return (
    <>
      <PageHeader title={t.title} />
      <ContentTabs current="/admin/contenido/tasas" />
      <p className="small muted">{t.ratesNote}</p>
      <section className="card card-body" style={{ marginBottom: 16 }}>
        <ActionForm action={addExchangeRate} submit={t.addRate} resetOnSuccess>
          <div className="form-grid">
            <div className="field"><label htmlFor="r-b">{t.baseCurrency}</label><select id="r-b" name="base" className="select" defaultValue="USD"><option value="USD">USD</option><option value="DOP">DOP</option></select></div>
            <div className="field"><label htmlFor="r-q">{t.quoteCurrency}</label><select id="r-q" name="quote" className="select" defaultValue="DOP"><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
            <div className="field"><label htmlFor="r-r" className="required">{t.rateField}</label><input id="r-r" name="rate" type="number" min="0.000001" step="0.000001" className="input" required /></div>
            <div className="field"><label htmlFor="r-d" className="required">{t.rateDate}</label><input id="r-d" name="rate_date" type="date" className="input" required defaultValue={localDay(new Date())} /></div>
            <div className="field"><label htmlFor="r-s" className="required">{t.source}</label><input id="r-s" name="source" className="input" required minLength={2} maxLength={200} placeholder="Banco Central de la República Dominicana" /></div>
          </div>
        </ActionForm>
      </section>
      {error && <p className="alert alert-error">{t.ratesError}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t.date}</th><th>{t.pair}</th><th>{t.rate}</th><th>{t.source}</th><th>{t.enteredBy}</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted">{t.noRates}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.rate_date)}</td>
                <td>1 {r.base} = {r.quote}</td>
                <td>{formatNumber(r.rate, 6)}</td>
                <td className="small">{r.source}</td>
                <td className="small">{labelFor(people, r.entered_by)} · {formatDate(r.created_at, true)}</td>
                <td>
                  <ActionForm action={deleteExchangeRate} submit={t.delete} buttonClass="btn btn-ghost btn-sm" confirm={t.deleteRateConfirm}>
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
