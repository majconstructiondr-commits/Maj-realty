import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cotizaciones",
  description: "Solicita una cotización de remodelación, administración, gestiones legales u otros servicios inmobiliarios.",
  alternates: { canonical: "/cotizaciones" },
};

export default async function Page() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Servicio" title="Cotizaciones" lead="Pide un presupuesto. Lo prepara personal autorizado después de evaluar tu caso, con partidas, impuestos aplicables, vigencia y condiciones." />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>Qué recibirás</h2>
            <ul>
              <li>Partidas con cantidades, precios unitarios y moneda.</li>
              <li>Impuestos aplicables según la configuración vigente.</li>
              <li>Exclusiones, vigencia, etapas y condiciones de pago.</li>
              <li>Opción de aceptar o rechazar desde <Link href="/panel/cotizaciones">tu cuenta</Link>, con historial.</li>
            </ul>
            <p className="xs muted">No enviamos montos definitivos sin evaluación. Una solicitud no es un contrato ni una aceptación de precio.</p>
            <ContactButtons s={s} servicio="una cotización" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>Solicitar cotización</h2>
            <RequestForm kind="cotizacion" allowFiles filesLabel="Archivos de referencia (opcional)" messageLabel="Comentarios adicionales">
              <fieldset className="fieldset">
                <legend>Lo que necesitas</legend>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="cot-serv" className="required">Servicio</label>
                    <select id="cot-serv" name="servicio" className="select" required defaultValue="">
                      <option value="" disabled>Seleccione…</option>
                      <option value="remodelacion">Remodelación</option>
                      <option value="administracion">Administración</option>
                      <option value="legal">Gestión legal</option>
                      <option value="venta">Venta</option>
                      <option value="renta">Renta</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="cot-ref">Inmueble o referencia (opcional)</label>
                    <input id="cot-ref" name="referencia_inmueble" className="input" maxLength={60} placeholder="MAJ-001023 o dirección general" />
                  </div>
                  <div className="field span-2">
                    <label htmlFor="cot-alc" className="required">Alcance</label>
                    <textarea id="cot-alc" name="alcance" className="textarea" required minLength={10} maxLength={2000} />
                  </div>
                </div>
              </fieldset>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
