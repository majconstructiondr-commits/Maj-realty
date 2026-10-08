import { CONTRACT_STATUSES, MGMT_SERVICES } from "@/lib/admin/labels";

export type ContractValues = {
  property_label?: string; location_summary?: string | null; property_id?: string | null; units?: number; services?: string[];
  fee_terms?: string | null; start_date?: string; end_date?: string | null; status?: string;
};

export function ContractFields({ v = {}, today }: { v?: ContractValues; today: string }) {
  return (
    <>
      <div className="form-grid">
        <div className="field"><label htmlFor="c-pl" className="required">Inmueble administrado</label><input id="c-pl" name="property_label" className="input" required minLength={2} maxLength={200} defaultValue={v.property_label ?? ""} /></div>
        <div className="field"><label htmlFor="c-ls">Ubicación (resumen)</label><input id="c-ls" name="location_summary" className="input" maxLength={300} defaultValue={v.location_summary ?? ""} /></div>
        <div className="field"><label htmlFor="c-pid">ID de publicación vinculada (opcional)</label><input id="c-pid" name="property_id" className="input" maxLength={36} defaultValue={v.property_id ?? ""} placeholder="uuid" /></div>
        <div className="field"><label htmlFor="c-u" className="required">Unidades</label><input id="c-u" name="units" type="number" min={1} max={10000} className="input" required defaultValue={v.units ?? 1} /></div>
        <div className="field"><label htmlFor="c-sd" className="required">Inicio</label><input id="c-sd" name="start_date" type="date" className="input" required defaultValue={v.start_date ?? today} /></div>
        <div className="field"><label htmlFor="c-ed">Fin</label><input id="c-ed" name="end_date" type="date" className="input" defaultValue={v.end_date ?? ""} /></div>
        <div className="field"><label htmlFor="c-st">Estado</label><select id="c-st" name="status" className="select" defaultValue={v.status ?? "borrador"}>{Object.entries(CONTRACT_STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <fieldset className="fieldset"><legend>Servicios</legend>
        <div className="chip-group">
          {Object.entries(MGMT_SERVICES).map(([k, l]) => (
            <label key={k} className="chip"><input type="checkbox" name="services" value={k} defaultChecked={v.services?.includes(k)} /> {l}</label>
          ))}
        </div>
      </fieldset>
      <div className="field"><label htmlFor="c-fee">Honorarios y condiciones</label><textarea id="c-fee" name="fee_terms" className="textarea" maxLength={2000} defaultValue={v.fee_terms ?? ""} /></div>
    </>
  );
}
