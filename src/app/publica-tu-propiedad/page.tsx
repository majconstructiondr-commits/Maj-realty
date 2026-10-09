import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { LocationFields, TypeSelect } from "@/components/forms/CommonFields";

export const metadata: Metadata = {
  title: "Publica tu propiedad",
  description: "Vende o renta tu inmueble con MAJ REALTY: publícalo tú mismo con una licencia de publicación o déjalo en manos de un asesor.",
  alternates: { canonical: "/publica-tu-propiedad" },
};

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Propietarios, vendedores y agencias" title="Publica tu propiedad" lead="Elige cómo quieres hacerlo: con un asesor de MAJ o publicando tú mismo desde tu cuenta." />
      <div className="container section">
        <div className="grid-2">
          <div className="card card-body stack">
            <h2>Opción 1: con un asesor</h2>
            <p>Nos das los datos básicos, coordinamos una visita de evaluación y preparamos la publicación contigo. Necesitamos tu autorización como propietario o representante.</p>
            <a className="btn btn-primary" href="#captacion">Solicitar asesor</a>
          </div>
          <div className="card card-body stack">
            <h2>Opción 2: publica tú mismo</h2>
            <p>
              Crea tu cuenta y solicita una <strong>licencia de publicación</strong>: es un permiso contractual interno para publicar en MAJ, no una licencia profesional ni gubernamental.
            </p>
            <ol className="small">
              <li>Registro y verificación de correo.</li>
              <li>Perfil y aceptación de las condiciones de publicación.</li>
              <li>Documentación necesaria (solo la proporcional al propósito).</li>
              <li>Revisión de MAJ y activación de la licencia.</li>
              <li>Creas borradores; cada publicación se revisa antes de salir.</li>
            </ol>
            <div className="row">
              <Link className="btn btn-gold" href="/cuenta/registro?siguiente=/panel/publicar">Crear cuenta</Link>
              <Link className="btn btn-ghost" href="/cuenta/ingresar?siguiente=/panel/publicar">Ya tengo cuenta</Link>
            </div>
            <p className="xs muted">Planes Individual, Profesional y Agencia con precios y cuotas definidos por MAJ. <Link href="/legal/condiciones-publicacion">Condiciones de publicación</Link>.</p>
          </div>
        </div>
        <div className="card card-body" id="captacion" style={{ marginTop: 24 }}>
          <h2>Solicitar asesor para vender o rentar</h2>
          <RequestForm kind="venta_captacion" allowFiles filesLabel="Fotos (opcional)" messageLabel="Preferencias o comentarios">
            <fieldset className="fieldset">
              <legend>El inmueble</legend>
              <div className="form-grid cols-3">
                <TypeSelect id="cap-tipo" />
                <LocationFields prefix="cap" />
                <div className="field">
                  <label htmlFor="cap-precio">Precio esperado (opcional)</label>
                  <input id="cap-precio" name="precio_esperado" className="input" inputMode="decimal" />
                </div>
                <div className="field">
                  <label htmlFor="cap-mon">Moneda</label>
                  <select id="cap-mon" name="moneda" className="select" defaultValue="">
                    <option value="">Seleccione…</option>
                    <option value="DOP">Pesos (RD$)</option>
                    <option value="USD">Dólares (US$)</option>
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="cap-pref">Operación y preferencias</label>
                <textarea id="cap-pref" name="preferencias" className="textarea" maxLength={1000} placeholder="Venta, renta o ambas; horarios para visitas; condiciones." />
              </div>
              <label className="check" style={{ marginTop: 12 }}>
                <input type="checkbox" name="autorizado" /> <span>Soy el propietario o tengo autorización para gestionar este inmueble.</span>
              </label>
              <label className="check" style={{ marginTop: 8 }}>
                <input type="checkbox" name="visita_evaluacion" defaultChecked /> <span>Solicito una visita de evaluación.</span>
              </label>
            </fieldset>
          </RequestForm>
        </div>
      </div>
    </>
  );
}
