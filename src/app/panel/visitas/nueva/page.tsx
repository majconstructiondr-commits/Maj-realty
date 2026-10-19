import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { bookingWindow, describeHours } from "@/lib/panel/appointments";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { NewAppointmentForm } from "./NewAppointmentForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.newVisit.meta };
}

export default async function Page(props: PageProps<"/panel/visitas/nueva">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.inmueble) ? sp.inmueble[0] : sp.inmueble;
  const code = typeof raw === "string" && /^[A-Za-z]+-\d{4,}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null;
  await requireUser(`/panel/visitas/nueva${code ? `?inmueble=${code}` : ""}`);
  const supabase = await createClient();
  const s = await getSiteSettings();
  const { d } = await getI18n();
  const t = d.panel.newVisit;
  const { data: p } = code ? await supabase.from("catalog").select("id, code, slug, title, sector, municipality, province").eq("code", code).maybeSingle() : { data: null };

  const lead = Number(s["appointments.min_lead_hours"]) || 12;
  const duration = Number(s["appointments.duration_minutes"]) || 60;
  const { minDate, maxDate } = bookingWindow(lead);
  const schedule = describeHours(s["appointments.hours"], d.panel.slots);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted">
        <Link href="/panel/visitas">{d.panel.visits.title}</Link> / <span aria-current="page">{t.breadcrumb}</span>
      </nav>
      <h1>{t.title}</h1>
      {!p ? (
        <div className="card empty">
          <p>{code ? d.panel.shared.notAvailable : t.pick}</p>
          <Link className="btn btn-primary" href="/venta">{d.panel.shared.viewProperties}</Link>
        </div>
      ) : (
        <>
          <section className="card card-body">
            <p style={{ marginTop: 0 }}>
              {d.panel.shared.propertyLabel} <Link href={listingHref(p)}>{p.title}</Link> <span className="muted">({p.code})</span>
            </p>
            <p className="small">
              {t.howBefore} <strong>{t.howTz}</strong>{fmt(t.howLead, { lead })}{" "}
              {t.howStatusBefore} <strong>{t.howStatus}</strong> {t.howStatusAfter}
            </p>
            <NewAppointmentForm propertyId={p.id} hours={s["appointments.hours"]} duration={duration} minDate={minDate} maxDate={maxDate} />
          </section>
          <section className="card card-body" aria-labelledby="horario">
            <h2 id="horario" style={{ marginTop: 0 }}>{t.schedule}</h2>
            <table className="table">
              <caption className="sr-only">{t.scheduleCaption}</caption>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.day}><th scope="row" style={{ textTransform: "capitalize" }}>{row.day}</th><td>{row.hours}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
