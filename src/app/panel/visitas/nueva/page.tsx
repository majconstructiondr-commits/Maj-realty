import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { bookingWindow, describeHours } from "@/lib/panel/appointments";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { NewAppointmentForm } from "./NewAppointmentForm";

export const metadata: Metadata = { title: "Agendar visita" };

export default async function Page(props: PageProps<"/panel/visitas/nueva">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.inmueble) ? sp.inmueble[0] : sp.inmueble;
  const code = typeof raw === "string" && /^[A-Za-z]+-\d{4,}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null;
  await requireUser(`/panel/visitas/nueva${code ? `?inmueble=${code}` : ""}`);
  const supabase = await createClient();
  const s = await getSiteSettings();
  const { data: p } = code ? await supabase.from("catalog").select("id, code, slug, title, sector, municipality, province").eq("code", code).maybeSingle() : { data: null };

  const lead = Number(s["appointments.min_lead_hours"]) || 12;
  const duration = Number(s["appointments.duration_minutes"]) || 60;
  const { minDate, maxDate } = bookingWindow(lead);
  const schedule = describeHours(s["appointments.hours"]);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label="Ruta" className="small muted">
        <Link href="/panel/visitas">Visitas</Link> / <span aria-current="page">Agendar</span>
      </nav>
      <h1>Agendar visita</h1>
      {!p ? (
        <div className="card empty">
          <p>{code ? "Ese inmueble no está disponible o el código no existe." : "Elija el inmueble desde su ficha para agendar una visita."}</p>
          <Link className="btn btn-primary" href="/venta">Ver inmuebles</Link>
        </div>
      ) : (
        <>
          <section className="card card-body">
            <p style={{ marginTop: 0 }}>
              Inmueble: <Link href={listingHref(p)}>{p.title}</Link> <span className="muted">({p.code})</span>
            </p>
            <p className="small">
              Elija fecha y hora en <strong>hora de Santo Domingo</strong>. Se requiere al menos {lead} horas de anticipación.
              La visita queda <strong>solicitada</strong> hasta que el asesor la confirme.
            </p>
            <NewAppointmentForm propertyId={p.id} hours={s["appointments.hours"]} duration={duration} minDate={minDate} maxDate={maxDate} />
          </section>
          <section className="card card-body" aria-labelledby="horario">
            <h2 id="horario" style={{ marginTop: 0 }}>Horario de visitas</h2>
            <table className="table">
              <caption className="sr-only">Horario semanal</caption>
              <tbody>
                {schedule.map((d) => (
                  <tr key={d.day}><th scope="row" style={{ textTransform: "capitalize" }}>{d.day}</th><td>{d.hours}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
