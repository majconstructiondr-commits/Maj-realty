"use client";
// Formularios de los pasos 1–5 y 7 del editor de publicaciones.
import { useState } from "react";
import {
  CONDITIONS, FEATURES, NUMERIC_FIELDS, OPERATIONS, PROPERTY_TYPES, PROVINCES, RENT_PERIODS, SPACE_FIELDS, TRI, fieldApplies,
  type PropertyType,
} from "@/lib/catalog/definitions";
import {
  ID_TYPES, NUMERIC_LIMITS, NUMERIC_MODES, RELATIONSHIPS, SURVEY_STATUSES, featureKeys, initialNumericMode, initialSpaceValue,
  numericFieldKeys, operationsFor, spaceFieldKeys, type NumericMode,
} from "@/lib/listing-editor/schemas";
import type { EditorPrice, EditorPrivate, EditorProperty } from "@/lib/listing-editor/types";
import { EditorForm } from "./EditorForm";
import { CheckField, FieldErr, SelectField, TextAreaField, TextField, describedBy, str, type Errors } from "./fields";

type StepProps = { propertyId: string; live: boolean };

// ---------------------------------------------------------------------
// 1. Datos básicos
// ---------------------------------------------------------------------
export function StepBasics({ propertyId, live, p }: StepProps & { p: Pick<EditorProperty, "title" | "operation" | "property_type" | "condition" | "description" | "available_from"> }) {
  const [desc, setDesc] = useState(p.description ?? "");
  return (
    <EditorForm propertyId={propertyId} step={1} live={live}>
      {(errors) => (
        <fieldset className="fieldset">
          <legend>Datos básicos</legend>
          <div className="form-grid">
            <TextField className="span-2" name="title" label="Título de la publicación" required maxLength={140} defaultValue={p.title} errors={errors}
              hint="Ejemplo: Apartamento de 3 habitaciones con terraza en Piantini (5 a 140 caracteres)." />
            <SelectField name="operation" label="Operación" required options={OPERATIONS} defaultValue={p.operation} errors={errors} />
            <SelectField name="property_type" label="Tipo de inmueble" required options={PROPERTY_TYPES} defaultValue={p.property_type} errors={errors} />
            <SelectField name="condition" label="Condición" options={CONDITIONS} defaultValue={p.condition} placeholder="Sin indicar" errors={errors} />
            <TextField name="available_from" type="date" label="Disponible desde" defaultValue={p.available_from} errors={errors}
              hint={live ? "Esta fecha se actualiza de inmediato, sin revisión." : "Opcional."} />
            <div className="field span-2">
              <label htmlFor="f-description">Descripción</label>
              <textarea id="f-description" name="description" className="textarea" rows={8} maxLength={8000} value={desc}
                onChange={(e) => setDesc(e.currentTarget.value)} {...describedBy("description", errors, true)} />
              <span className="hint" id="description-hint">
                {desc.trim().length} / 8000 caracteres. Para enviar a revisión se necesitan al menos 30. Describa el inmueble con datos reales; no incluya teléfonos ni la dirección exacta.
              </span>
              <FieldErr errors={errors} name="description" />
            </div>
          </div>
        </fieldset>
      )}
    </EditorForm>
  );
}

// ---------------------------------------------------------------------
// 2. Ubicación
// ---------------------------------------------------------------------
export function StepLocation({ propertyId, live, p, priv }: StepProps & {
  p: Pick<EditorProperty, "province" | "municipality" | "sector" | "exact_address_public" | "public_address">;
  priv: Pick<EditorPrivate, "street" | "street_number" | "building" | "unit" | "exact_lat" | "exact_lng"> | null;
}) {
  const [showPublic, setShowPublic] = useState(Boolean(p.exact_address_public));
  return (
    <EditorForm propertyId={propertyId} step={2} live={live}>
      {(errors) => (
        <>
          <p className="alert alert-info small" style={{ margin: 0 }}>
            En la publicación solo se muestran la provincia, el municipio, el sector y una zona aproximada en el mapa (unos 1 km).
            La dirección exacta y las coordenadas quedan privadas: solo las ven usted, su organización autorizada y el personal de MAJ.
          </p>
          <fieldset className="fieldset">
            <legend>Zona (pública)</legend>
            <div className="form-grid">
              <SelectField name="province" label="Provincia" options={PROVINCES} defaultValue={p.province} placeholder="Seleccione…" errors={errors} />
              <TextField name="municipality" label="Municipio" maxLength={80} defaultValue={p.municipality} errors={errors} placeholder="Ej.: Santo Domingo de Guzmán" />
              <TextField className="span-2" name="sector" label="Sector" maxLength={120} defaultValue={p.sector} errors={errors} placeholder="Ej.: Piantini" />
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>Dirección exacta (privada)</legend>
            <div className="form-grid">
              <TextField name="street" label="Calle" maxLength={160} defaultValue={priv?.street} errors={errors} autoComplete="off" />
              <TextField name="street_number" label="Número" maxLength={30} defaultValue={priv?.street_number} errors={errors} autoComplete="off" />
              <TextField name="building" label="Edificio / residencial" maxLength={120} defaultValue={priv?.building} errors={errors} autoComplete="off" />
              <TextField name="unit" label="Unidad / apartamento" maxLength={40} defaultValue={priv?.unit} errors={errors} autoComplete="off" />
              <TextField name="exact_lat" label="Latitud exacta" inputMode="decimal" defaultValue={str(priv?.exact_lat)} errors={errors} placeholder="18.4712" />
              <TextField name="exact_lng" label="Longitud exacta" inputMode="decimal" defaultValue={str(priv?.exact_lng)} errors={errors} placeholder="-69.9412" />
            </div>
            <p className="xs muted" style={{ marginBottom: 0 }}>
              Con las coordenadas exactas calculamos la zona aproximada que se muestra en el mapa (redondeada). Las coordenadas exactas nunca se publican.
            </p>
          </fieldset>
          <fieldset className="fieldset">
            <legend>Mostrar la dirección exacta (opcional)</legend>
            <CheckField name="exact_address_public" label="Mostrar públicamente una dirección exacta" defaultChecked={p.exact_address_public} errors={errors}
              onChange={setShowPublic} hint="Solo si el propietario lo autorizó por escrito. Por defecto se muestra únicamente la zona aproximada." />
            {showPublic ? (
              <div className="form-grid" style={{ marginTop: 10 }}>
                <TextField className="span-2" name="public_address" label="Dirección que se mostrará" maxLength={300} defaultValue={p.public_address} errors={errors} required />
                <CheckField className="span-2" name="owner_authorized_address" label="Confirmo que el propietario autorizó mostrar esta dirección" defaultChecked={p.exact_address_public} errors={errors} />
              </div>
            ) : null}
          </fieldset>
        </>
      )}
    </EditorForm>
  );
}

// ---------------------------------------------------------------------
// 3. Precios
// ---------------------------------------------------------------------
export function StepPrices({ propertyId, live, operation, prices }: StepProps & { operation: "venta" | "renta" | "ambas"; prices: EditorPrice[] }) {
  return (
    <EditorForm propertyId={propertyId} step={3} live={live}>
      {(errors) => (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Indique cada precio en su moneda original (no se convierten ni se mezclan monedas). Si deja el importe vacío, la publicación mostrará “Precio a consultar”.
          </p>
          {operationsFor(operation).map((op) => (
            <PriceBlock key={op} op={op} p={prices.find((x) => x.operation === op)} errors={errors} />
          ))}
        </>
      )}
    </EditorForm>
  );
}

function PriceBlock({ op, p, errors }: { op: "venta" | "renta"; p?: EditorPrice; errors: Errors }) {
  const n = (k: string) => `${op}_${k}`;
  const cur = { DOP: "Pesos dominicanos (RD$)", USD: "Dólares (US$)" };
  return (
    <fieldset className="fieldset">
      <legend>{op === "venta" ? "Precio de venta" : "Precio de renta"}</legend>
      <div className="form-grid">
        <TextField name={n("amount")} label={op === "venta" ? "Importe" : "Importe de la renta"} inputMode="decimal" defaultValue={str(p?.amount)} errors={errors}
          hint="Vacío = precio a consultar." placeholder="Ej.: 250000" />
        <SelectField name={n("currency")} label="Moneda" required options={cur} defaultValue={p?.currency ?? (op === "venta" ? "USD" : "DOP")} errors={errors} />
        {op === "renta" ? (
          <SelectField name={n("rent_period")} label="Período" options={RENT_PERIODS} defaultValue={p?.rent_period ?? "mensual"} errors={errors} />
        ) : null}
        <CheckField name={n("negotiable")} label="Precio negociable" defaultChecked={p?.negotiable} errors={errors} />
        <TextField name={n("maintenance_amount")} label="Mantenimiento" inputMode="decimal" defaultValue={str(p?.maintenance_amount)} errors={errors} hint="Cuota de mantenimiento, si existe." />
        <SelectField name={n("maintenance_currency")} label="Moneda del mantenimiento" options={cur} defaultValue={p?.maintenance_currency} placeholder="Igual que el precio" errors={errors} />
        <SelectField name={n("maintenance_included")} label={op === "renta" ? "¿Mantenimiento incluido en la renta?" : "¿Mantenimiento incluido?"} options={TRI} defaultValue={p?.maintenance_included ?? "desconocido"} errors={errors} />
        {op === "renta" ? (
          <>
            <TextField name={n("deposit_amount")} label="Depósito (importe)" inputMode="decimal" defaultValue={str(p?.deposit_amount)} errors={errors} />
            <TextField name={n("deposit_months")} label="Depósito (meses)" inputMode="decimal" defaultValue={str(p?.deposit_months)} errors={errors} />
            <TextField name={n("advance_months")} label="Adelanto (meses)" inputMode="decimal" defaultValue={str(p?.advance_months)} errors={errors} />
            <TextField name={n("min_term_months")} label="Plazo mínimo (meses)" inputMode="numeric" defaultValue={str(p?.min_term_months)} errors={errors} />
          </>
        ) : null}
        <TextAreaField className="span-2" name={n("additional_costs")} label="Gastos adicionales" maxLength={1000} rows={3} defaultValue={p?.additional_costs} errors={errors} />
        <TextAreaField className="span-2" name={n("delivery_conditions")} label="Condiciones de entrega" maxLength={1000} rows={3} defaultValue={p?.delivery_conditions} errors={errors} />
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------
// 4. Distribución: valor / desconocido / no aplica
// ---------------------------------------------------------------------
type DistValues = Pick<EditorProperty, (typeof numericFieldKeys)[number] | (typeof spaceFieldKeys)[number] | "na_fields" | "roof_use_detail" | "property_type">;

export function StepDistribution({ propertyId, live, p }: StepProps & { p: DistValues }) {
  return (
    <EditorForm propertyId={propertyId} step={4} live={live}>
      {(errors) => (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Para cada dato elija una opción: <strong>Valor</strong> (el cero es válido, por ejemplo 0 parqueos), <strong>Desconocido</strong> o <strong>No aplica</strong>.
            Los campos que normalmente no aplican a un {PROPERTY_TYPES[p.property_type].toLowerCase()} aparecen marcados como “No aplica”; puede cambiarlos.
          </p>
          <fieldset className="fieldset">
            <legend>Dimensiones y cantidades</legend>
            <div className="le-num-grid">
              {numericFieldKeys.map((f) => (
                <NumericInput key={f} field={f} value={p[f]} mode={initialNumericMode(f, p[f], p.na_fields ?? [], p.property_type)} errors={errors} />
              ))}
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>Espacios</legend>
            <div className="form-grid cols-3">
              {spaceFieldKeys.map((s) => (
                <SelectField key={s} name={s} label={SPACE_FIELDS[s]} options={TRI} defaultValue={initialSpaceValue(s, p[s], p.property_type)} errors={errors}
                  hint={!fieldApplies(p.property_type as PropertyType, s) ? "Normalmente no aplica a este tipo." : undefined} />
              ))}
              <TextAreaField className="span-3" name="roof_use_detail" label="Uso del área de techo (detalle)" maxLength={500} rows={2} defaultValue={p.roof_use_detail} errors={errors}
                hint="Ej.: techo transitable con área de lavado; derecho de uso exclusivo." />
            </div>
          </fieldset>
        </>
      )}
    </EditorForm>
  );
}

function NumericInput({ field, value, mode: initial, errors }: { field: (typeof numericFieldKeys)[number]; value: number | string | null; mode: NumericMode; errors: Errors }) {
  const [mode, setMode] = useState<NumericMode>(initial);
  const def = NUMERIC_FIELDS[field];
  const lim = NUMERIC_LIMITS[field];
  const groupId = `g-${field}`;
  return (
    <div className="le-num" role="group" aria-labelledby={groupId}>
      <span id={groupId} className="label">
        {def.label}{def.unit ? ` (${def.unit})` : ""}
      </span>
      <div className="le-modes">
        {(Object.keys(NUMERIC_MODES) as NumericMode[]).map((m) => (
          <label key={m} className="chip">
            <input type="radio" name={`${field}__modo`} value={m} checked={mode === m} onChange={() => setMode(m)} />
            {NUMERIC_MODES[m]}
          </label>
        ))}
      </div>
      <label htmlFor={`f-${field}`} className="sr-only">{def.label}: valor</label>
      <input
        id={`f-${field}`}
        name={field}
        className="input"
        inputMode={lim.int ? "numeric" : "decimal"}
        defaultValue={str(value)}
        disabled={mode !== "valor"}
        placeholder={mode === "valor" ? (lim.min < 0 ? "Ej.: -1 (sótano)" : "0 es válido") : NUMERIC_MODES[mode]}
        {...describedBy(field, errors)}
      />
      <FieldErr errors={errors} name={field} />
    </div>
  );
}

// ---------------------------------------------------------------------
// 5. Características
// ---------------------------------------------------------------------
export function StepFeatures({ propertyId, live, p }: StepProps & { p: Pick<EditorProperty, "features" | "condo_rules" | "restrictions"> }) {
  const groups = [
    { scope: "inmueble", title: "Del inmueble" },
    { scope: "residencial", title: "Del residencial o edificio" },
  ] as const;
  return (
    <EditorForm propertyId={propertyId} step={5} live={live}>
      {(errors) => (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Indique Sí, No, Desconocido o No aplica. Las características en “Desconocido” sin detalle no se muestran en la publicación.
          </p>
          {groups.map((g) => (
            <fieldset key={g.scope} className="fieldset">
              <legend>{g.title}</legend>
              <div className="le-feature-grid">
                {featureKeys.filter((k) => FEATURES[k].scope === g.scope).map((k) => {
                  const cur = p.features?.[k];
                  return (
                    <div key={k} className="le-feature">
                      <SelectField name={`feat_${k}`} label={FEATURES[k].label} options={TRI} defaultValue={cur?.v ?? "desconocido"} errors={errors} />
                      <TextField name={`feat_${k}_detalle`} label={<span className="small muted">Detalle (opcional)</span>} maxLength={200} defaultValue={cur?.d} errors={errors}
                        placeholder={FEATURES[k].detail ?? ""} />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <fieldset className="fieldset">
            <legend>Reglas y restricciones</legend>
            <div className="form-grid">
              <TextAreaField className="span-2" name="condo_rules" label="Reglas del condominio" maxLength={3000} rows={4} defaultValue={p.condo_rules} errors={errors} />
              <TextAreaField className="span-2" name="restrictions" label="Restricciones" maxLength={2000} rows={3} defaultValue={p.restrictions} errors={errors}
                hint="Ej.: no se permite uso comercial; solo familias." />
            </div>
          </fieldset>
        </>
      )}
    </EditorForm>
  );
}

// ---------------------------------------------------------------------
// 7. Datos privados (declarados por el vendedor, no verificados por MAJ)
// ---------------------------------------------------------------------
export function StepPrivate({ propertyId, live, priv }: StepProps & { priv: EditorPrivate | null }) {
  const v = priv ?? ({} as Partial<EditorPrivate>);
  const [exclusive, setExclusive] = useState(v.exclusivity === true ? "si" : v.exclusivity === false ? "no" : "");
  return (
    <EditorForm propertyId={propertyId} step={7} live={live}>
      {(errors) => (
        <>
          <p className="alert alert-info small" style={{ margin: 0 }}>
            Estos datos son privados: no se muestran en la publicación. Solo los ven usted, su organización autorizada y el personal de MAJ.
          </p>
          <fieldset className="fieldset">
            <legend>Propietario</legend>
            <div className="form-grid">
              <TextField name="owner_name" label="Nombre del propietario" maxLength={160} defaultValue={v.owner_name} errors={errors} autoComplete="off" />
              <TextField name="owner_phone" label="Teléfono" type="tel" maxLength={40} defaultValue={v.owner_phone} errors={errors} autoComplete="off" />
              <TextField name="owner_email" label="Correo" type="email" maxLength={160} defaultValue={v.owner_email} errors={errors} autoComplete="off" />
              <SelectField name="owner_id_type" label="Tipo de documento" options={ID_TYPES} defaultValue={v.owner_id_type} placeholder="Sin indicar" errors={errors} />
              <TextField name="owner_id_number" label="Número de documento" maxLength={40} defaultValue={v.owner_id_number} errors={errors} autoComplete="off" />
              <SelectField name="publisher_relationship" label="Su relación con el inmueble" options={RELATIONSHIPS} defaultValue={v.publisher_relationship} placeholder="Seleccione…" errors={errors} />
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>Autorización y condiciones</legend>
            <div className="form-grid">
              <CheckField className="span-2" name="publication_authorized" label="El propietario autorizó publicar este inmueble en MAJ" defaultChecked={v.publication_authorized} errors={errors}
                hint="Obligatorio para enviar a revisión. Puede cargar la autorización firmada en Documentos." />
              <TextField name="authorization_date" type="date" label="Fecha de la autorización" defaultValue={v.authorization_date} errors={errors} />
              <TextField name="authorization_expires" type="date" label="Vence la autorización" defaultValue={v.authorization_expires} errors={errors} />
              <TextAreaField className="span-2" name="commission_terms" label="Condiciones de comisión" maxLength={1000} rows={2} defaultValue={v.commission_terms} errors={errors} />
              <div className="field">
                <label htmlFor="f-exclusivity">Exclusividad</label>
                <select id="f-exclusivity" name="exclusivity" className="select" value={exclusive} onChange={(e) => setExclusive(e.currentTarget.value)} {...describedBy("exclusivity", errors)}>
                  <option value="">Sin indicar</option>
                  <option value="si">Sí, exclusiva</option>
                  <option value="no">No exclusiva</option>
                </select>
                <FieldErr errors={errors} name="exclusivity" />
              </div>
              {exclusive === "si" ? (
                <TextField name="exclusivity_expires" type="date" label="Vence la exclusividad" defaultValue={v.exclusivity_expires} errors={errors} />
              ) : null}
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>Información legal declarada</legend>
            <p className="alert alert-warning small" style={{ marginTop: 0 }}>
              <strong>Declarado por el vendedor, no verificado por MAJ.</strong> Registrar estos datos no implica una revisión jurídica. MAJ solo indica una revisión documental cuando la realiza, con fecha y alcance.
            </p>
            <div className="form-grid">
              <TextField name="title_type" label="Tipo de título" maxLength={120} defaultValue={v.title_type} errors={errors} placeholder="Ej.: Certificado de título" />
              <TextField name="title_registry_number" label="Matrícula" maxLength={120} defaultValue={v.title_registry_number} errors={errors} />
              <TextField name="cadastral_designation" label="Designación catastral" maxLength={160} defaultValue={v.cadastral_designation} errors={errors} />
              <SelectField name="survey_status" label="Estado de deslinde" options={SURVEY_STATUSES} defaultValue={v.survey_status} placeholder="Sin indicar" errors={errors} />
              <TextField name="legal_status_certificate_date" type="date" label="Fecha de la certificación del estado jurídico" defaultValue={v.legal_status_certificate_date} errors={errors} />
              <TextAreaField className="span-2" name="declared_liens" label="Cargas o gravámenes declarados" maxLength={2000} rows={2} defaultValue={v.declared_liens} errors={errors} />
              <TextAreaField className="span-2" name="tax_notes" label="Notas sobre impuestos" maxLength={2000} rows={2} defaultValue={v.tax_notes} errors={errors} />
              <TextAreaField className="span-2" name="contract_notes" label="Notas sobre contratos" maxLength={2000} rows={2} defaultValue={v.contract_notes} errors={errors} />
            </div>
          </fieldset>
        </>
      )}
    </EditorForm>
  );
}
