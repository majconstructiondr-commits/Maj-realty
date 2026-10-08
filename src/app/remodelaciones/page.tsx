import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { LocationFields } from "@/components/forms/CommonFields";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getPortfolio } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Remodelaciones",
  description: "Solicita una visita técnica para tu remodelación en República Dominicana.",
  alternates: { canonical: "/remodelaciones" },
};

export default async function Page() {
  const [s, portfolio] = await Promise.all([getSiteSettings(), getPortfolio()]);
  return (
    <>
      <PageHero eyebrow="Servicio" title="Remodelaciones" lead="Cuéntanos qué quieres mejorar. Evaluamos en sitio antes de presupuestar: no damos estimados definitivos sin visita técnica." />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>Cómo funciona</h2>
            <ol className="steps" style={{ gridTemplateColumns: "1fr" }}>
              <li className="card"><h3>Solicitud</h3><p className="small muted">Describe el trabajo, el área aproximada y adjunta fotos.</p></li>
              <li className="card"><h3>Visita técnica</h3><p className="small muted">Coordinamos una visita para medir y evaluar el alcance.</p></li>
              <li className="card"><h3>Cotización</h3><p className="small muted">Recibes un presupuesto con partidas, vigencia, etapas y condiciones, que puedes aceptar o rechazar desde tu cuenta.</p></li>
            </ol>
            {portfolio.length ? (
              <>
                <h2 style={{ marginTop: 24 }}>Trabajos realizados</h2>
                <div className="grid-2">
                  {portfolio.map((p) => (
                    <figure key={p.id} className="card" style={{ margin: 0, overflow: "hidden" }}>
                      <div className="grid-2" style={{ gap: 2 }}>
                        {p.before_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.before_url} alt={`${p.title}: antes`} style={{ aspectRatio: "4/3", objectFit: "cover", width: "100%" }} />
                        ) : null}
                        {p.after_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.after_url} alt={`${p.title}: después`} style={{ aspectRatio: "4/3", objectFit: "cover", width: "100%" }} />
                        ) : null}
                      </div>
                      <figcaption className="card-body">
                        <strong>{p.title}</strong>
                        {p.location_summary ? <span className="small muted"> · {p.location_summary}</span> : null}
                        {p.description ? <p className="small muted" style={{ margin: "6px 0 0" }}>{p.description}</p> : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </>
            ) : null}
            <ContactButtons s={s} servicio="una remodelación" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>Solicitar visita técnica</h2>
            <RequestForm kind="remodelacion" allowFiles filesLabel="Fotos del área (opcional)" messageLabel="Comentarios adicionales">
              <fieldset className="fieldset">
                <legend>El trabajo</legend>
                <div className="form-grid">
                  <div className="field span-2">
                    <label htmlFor="rem-tipo" className="required">Tipo de trabajo</label>
                    <input id="rem-tipo" name="tipo_trabajo" className="input" required minLength={2} maxLength={120} placeholder="Cocina, baño, pintura, pisos, ampliación…" />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-area">Área aproximada (m²)</label>
                    <input id="rem-area" name="area_m2" type="number" min={0} step="0.5" className="input" />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-urg">Urgencia</label>
                    <select id="rem-urg" name="urgencia" className="select" defaultValue="normal">
                      <option value="baja">Baja</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                  <div className="field span-2">
                    <label htmlFor="rem-alc">Alcance</label>
                    <textarea id="rem-alc" name="alcance" className="textarea" maxLength={2000} placeholder="Qué se debe hacer, materiales deseados, medidas conocidas…" />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-pres">Presupuesto disponible (opcional)</label>
                    <input id="rem-pres" name="presupuesto" className="input" inputMode="decimal" />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-mon">Moneda</label>
                    <select id="rem-mon" name="moneda" className="select" defaultValue="">
                      <option value="">Seleccione…</option>
                      <option value="DOP">Pesos (RD$)</option>
                      <option value="USD">Dólares (US$)</option>
                    </select>
                  </div>
                  <LocationFields prefix="rem" />
                  <div className="field">
                    <label htmlFor="rem-fecha">Fecha deseada</label>
                    <input id="rem-fecha" name="fecha_deseada" type="date" className="input" />
                  </div>
                </div>
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" name="visita_tecnica" defaultChecked /> <span>Solicito una visita técnica</span>
                </label>
              </fieldset>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
