import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { TypeSelect } from "@/components/forms/CommonFields";

export const metadata: Metadata = {
  title: "Busco una propiedad",
  description: "Cuéntanos qué inmueble buscas en República Dominicana y te contactamos con opciones.",
  alternates: { canonical: "/busco-propiedad" },
};

export default async function Page(props: PageProps<"/busco-propiedad">) {
  const sp = await props.searchParams;
  const op = sp.operacion === "renta" ? "renta" : "venta";
  return (
    <>
      <PageHero eyebrow="Te ayudamos a buscar" title="Busco una propiedad" lead="Aunque hoy no tengamos un inmueble que coincida, guardamos tu búsqueda y te contactamos cuando haya opciones." />
      <div className="container section" style={{ maxWidth: 820 }}>
        <div className="card card-body">
          <RequestForm kind="busco_propiedad" submitLabel="Enviar búsqueda" messageLabel="Otros detalles">
            <fieldset className="fieldset">
              <legend>Qué buscas</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="bp-op" className="required">Operación</label>
                  <select id="bp-op" name="operacion" className="select" defaultValue={op} required>
                    <option value="venta">Comprar</option>
                    <option value="renta">Rentar</option>
                  </select>
                </div>
                <TypeSelect id="bp-tipo" />
                <div className="field span-2">
                  <label htmlFor="bp-zonas" className="required">Zonas de interés</label>
                  <input id="bp-zonas" name="zonas" className="input" required minLength={2} maxLength={300} placeholder="Ej.: Naco, Piantini, Santiago centro" />
                </div>
                <div className="field">
                  <label htmlFor="bp-pres">Presupuesto máximo</label>
                  <input id="bp-pres" name="presupuesto_max" className="input" inputMode="decimal" />
                </div>
                <div className="field">
                  <label htmlFor="bp-mon">Moneda</label>
                  <select id="bp-mon" name="moneda" className="select" defaultValue="">
                    <option value="">Seleccione…</option>
                    <option value="DOP">Pesos (RD$)</option>
                    <option value="USD">Dólares (US$)</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="bp-hab">Habitaciones (mín.)</label>
                  <input id="bp-hab" name="habitaciones" type="number" min={0} max={20} className="input" />
                </div>
                <div className="field">
                  <label htmlFor="bp-fecha">¿Para cuándo?</label>
                  <input id="bp-fecha" name="fecha" type="date" className="input" />
                </div>
              </div>
            </fieldset>
          </RequestForm>
        </div>
      </div>
    </>
  );
}
