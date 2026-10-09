import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { LocationFields, TypeSelect } from "@/components/forms/CommonFields";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Administración de propiedades",
  description: "Administración de inmuebles en renta en República Dominicana: cobros, mantenimiento, contratos e informes para propietarios.",
  alternates: { canonical: "/administracion" },
};

export default async function Page() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Servicio" title="Administración de propiedades" lead="Nos ocupamos de la gestión diaria de tu inmueble en renta y te damos acceso a un portal con tus informes." />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>Qué incluye</h2>
            <div className="grid-2">
              {[
                ["Portal del propietario", "Consulta tus inmuebles, rentas, gastos, mantenimiento, contratos y estados de cuenta. Cada propietario ve solo su cartera."],
                ["Cobros y comprobantes", "Registro de rentas cobradas y gastos con comprobantes y conciliación. Los pagos se gestionan de forma manual."],
                ["Mantenimiento", "Solicitudes de mantenimiento con seguimiento de estado y costos estimados."],
                ["Contratos e inquilinos", "Coordinación de búsqueda de inquilinos, evaluación documental y contratos."],
              ].map(([t, d]) => (
                <div key={t} className="card card-body"><h3>{t}</h3><p className="small muted" style={{ margin: 0 }}>{d}</p></div>
              ))}
            </div>
            <p className="xs muted">
              El portal es un registro operativo de la administración. No es un servicio bancario ni contabilidad fiscal certificada. Los servicios incluidos y las tarifas se acuerdan por contrato.
            </p>
            <p className="small">¿Ya eres cliente? <Link href="/panel/administracion">Entra a tu portal</Link>.</p>
            <ContactButtons s={s} servicio="el servicio de administración de propiedades" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>Solicitar administración</h2>
            <RequestForm kind="administracion" allowFiles filesLabel="Documentos opcionales (contratos vigentes, fotos)" messageLabel="Comentarios adicionales">
              <fieldset className="fieldset">
                <legend>El inmueble</legend>
                <div className="form-grid">
                  <TypeSelect id="adm-tipo" />
                  <div className="field">
                    <label htmlFor="adm-unid">Cantidad de unidades</label>
                    <input id="adm-unid" name="unidades" type="number" min={1} max={10000} className="input" />
                  </div>
                  <LocationFields prefix="adm" />
                  <div className="field">
                    <label htmlFor="adm-ocup">Ocupación actual</label>
                    <select id="adm-ocup" name="ocupacion" className="select" defaultValue="">
                      <option value="">Seleccione…</option>
                      <option value="ocupado">Ocupado</option>
                      <option value="vacio">Vacío</option>
                      <option value="parcial">Parcialmente ocupado</option>
                    </select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 14 }}>
                  <span className="label">Servicios requeridos</span>
                  <div className="chip-group">
                    {[["cobro_rentas", "Cobro de rentas"], ["mantenimiento", "Mantenimiento"], ["busqueda_inquilinos", "Búsqueda de inquilinos"], ["contratos", "Contratos"], ["informes", "Informes"], ["pagos_servicios", "Pago de servicios"]].map(([k, v]) => (
                      <label key={k} className="chip"><input type="checkbox" name="servicios" value={k} /> {v}</label>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="adm-sit">Situación actual</label>
                  <textarea id="adm-sit" name="situacion_actual" className="textarea" maxLength={1000} placeholder="Ej.: contrato vigente hasta marzo, atrasos, reparaciones pendientes…" />
                </div>
              </fieldset>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
