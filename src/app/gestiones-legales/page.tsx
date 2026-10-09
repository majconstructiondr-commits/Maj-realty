import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getEnabledLegalServices } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Gestiones legales de propiedades",
  description: "Solicita revisión de títulos, contratos y otras gestiones de propiedades con profesionales responsables.",
  alternates: { canonical: "/gestiones-legales" },
};

export default async function Page() {
  const [s, services] = await Promise.all([getSiteSettings(), getEnabledLegalServices()]);
  return (
    <>
      <PageHero eyebrow="Servicio" title="Gestiones legales de propiedades" lead="Coordinamos gestiones documentales de inmuebles con el profesional responsable de cada servicio." />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>Proceso</h2>
            <ol className="timeline">
              {["Solicitud", "Revisión del profesional responsable", "Documentos requeridos", "Cotización", "Tu aprobación", "Trámite", "Entrega"].map((p, i) => (
                <li key={p}><strong>{i + 1}. {p}</strong></li>
              ))}
            </ol>
            <div className="alert alert-info small">
              Una solicitud no es un trámite oficial realizado ni una opinión jurídica. Cada caso lo revisa un profesional competente antes de cotizar. Tus datos y archivos son privados.
            </div>
            {services.length ? (
              <>
                <h2>Servicios disponibles</h2>
                <div className="grid-2">
                  {services.map((sv) => (
                    <div key={sv.code} className="card card-body"><h3>{sv.name}</h3>{sv.description ? <p className="small muted" style={{ margin: 0 }}>{sv.description}</p> : null}</div>
                  ))}
                </div>
              </>
            ) : null}
            <ContactButtons s={s} servicio="gestiones legales de propiedades" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>Solicitar gestión</h2>
            {services.length ? (
              <RequestForm kind="legal" allowFiles filesLabel="Documentos (opcional, privados)" messageLabel="Comentarios adicionales">
                <fieldset className="fieldset">
                  <legend>Tu caso</legend>
                  <div className="field">
                    <label htmlFor="leg-srv" className="required">Servicio</label>
                    <select id="leg-srv" name="service_code" className="select" required defaultValue="">
                      <option value="" disabled>Seleccione…</option>
                      {services.map((sv) => <option key={sv.code} value={sv.code}>{sv.name}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor="leg-ref">Inmueble o referencia (opcional)</label>
                    <input id="leg-ref" name="referencia_inmueble" className="input" maxLength={60} />
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor="leg-desc" className="required">Describe tu caso</label>
                    <textarea id="leg-desc" name="descripcion" className="textarea" required minLength={10} maxLength={2000} />
                  </div>
                </fieldset>
              </RequestForm>
            ) : (
              <div className="stack">
                <p>Estamos habilitando estos servicios con los profesionales responsables. Por ahora, escríbenos y te orientamos.</p>
                <ContactButtons s={s} servicio="gestiones legales de propiedades" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
