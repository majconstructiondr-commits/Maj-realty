"use client";
// Formularios de los pasos 1–5 y 7 del editor de publicaciones.
import { useState } from "react";
import { FEATURES, NUMERIC_FIELDS, PROVINCES, fieldApplies, type PropertyType } from "@/lib/catalog/definitions";
import {
  NUMERIC_LIMITS, NUMERIC_MODES, asksTitleInfo, featureKeys, initialNumericMode, initialSpaceValue,
  numericFieldKeys, operationsFor, spaceFieldKeys, type NumericMode,
} from "@/lib/listing-editor/schemas";
import { fmt, usePrivateI18n } from "@/i18n/client";
import type { EditorPrice, EditorPrivate, EditorProperty } from "@/lib/listing-editor/types";
import { EditorForm } from "./EditorForm";
import { CheckField, FieldErr, SelectField, TextAreaField, TextField, describedBy, str, type Errors } from "./fields";

type StepProps = { propertyId: string; live: boolean };

// ---------------------------------------------------------------------
// 1. Datos básicos
// ---------------------------------------------------------------------
export function StepBasics({ propertyId, live, p }: StepProps & { p: Pick<EditorProperty, "title" | "operation" | "property_type" | "condition" | "description" | "available_from"> }) {
  const [desc, setDesc] = useState(p.description ?? "");
  const { d } = usePrivateI18n();
  const t = d.editor.basics;
  return (
    <EditorForm propertyId={propertyId} step={1} live={live}>
      {(errors) => (
        <fieldset className="fieldset">
          <legend>{d.editor.steps.basicos}</legend>
          <div className="form-grid">
            <TextField className="span-2" name="title" label={t.title} required maxLength={140} defaultValue={p.title} errors={errors}
              hint={t.titleHint} />
            <SelectField name="operation" label={t.operation} required options={d.labels.operations} defaultValue={p.operation} errors={errors} />
            <SelectField name="property_type" label={d.common.propertyType} required options={d.labels.propertyTypes} defaultValue={p.property_type} errors={errors} />
            <SelectField name="condition" label={t.condition} options={d.labels.conditions} defaultValue={p.condition} placeholder={d.editor.form.notSet} errors={errors} />
            <TextField name="available_from" type="date" label={t.availableFrom} defaultValue={p.available_from} errors={errors}
              hint={live ? t.availableLive : t.optional} />
            <div className="field span-2">
              <label htmlFor="f-description">{t.description}</label>
              <textarea id="f-description" name="description" className="textarea" rows={8} maxLength={8000} value={desc}
                onChange={(e) => setDesc(e.currentTarget.value)} {...describedBy("description", errors, true)} />
              <span className="hint" id="description-hint">
                {fmt(t.descriptionHint, { n: desc.trim().length })}
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
  const { d } = usePrivateI18n();
  const t = d.editor.location;
  return (
    <EditorForm propertyId={propertyId} step={2} live={live}>
      {(errors) => (
        <>
          <p className="alert alert-info small" style={{ margin: 0 }}>
            {t.intro}
          </p>
          <fieldset className="fieldset">
            <legend>{t.zone}</legend>
            <div className="form-grid">
              <SelectField name="province" label={d.common.province} options={PROVINCES} defaultValue={p.province} placeholder={d.editor.form.select} errors={errors} />
              <TextField name="municipality" label={d.common.municipality} maxLength={80} defaultValue={p.municipality} errors={errors} placeholder={t.municipalityPlaceholder} />
              <TextField className="span-2" name="sector" label={d.common.sector} maxLength={120} defaultValue={p.sector} errors={errors} placeholder={t.sectorPlaceholder} />
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>{t.exact}</legend>
            <div className="form-grid">
              <TextField name="street" label={t.street} maxLength={160} defaultValue={priv?.street} errors={errors} autoComplete="off" />
              <TextField name="street_number" label={t.number} maxLength={30} defaultValue={priv?.street_number} errors={errors} autoComplete="off" />
              <TextField name="building" label={t.building} maxLength={120} defaultValue={priv?.building} errors={errors} autoComplete="off" />
              <TextField name="unit" label={t.unit} maxLength={40} defaultValue={priv?.unit} errors={errors} autoComplete="off" />
              <TextField name="exact_lat" label={t.lat} inputMode="decimal" defaultValue={str(priv?.exact_lat)} errors={errors} placeholder="18.4712" />
              <TextField name="exact_lng" label={t.lng} inputMode="decimal" defaultValue={str(priv?.exact_lng)} errors={errors} placeholder="-69.9412" />
            </div>
            <p className="xs muted" style={{ marginBottom: 0 }}>
              {t.coordsNote}
            </p>
          </fieldset>
          <fieldset className="fieldset">
            <legend>{t.showExact}</legend>
            <CheckField name="exact_address_public" label={t.showExactLabel} defaultChecked={p.exact_address_public} errors={errors}
              onChange={setShowPublic} hint={t.showExactHint} />
            {showPublic ? (
              <div className="form-grid" style={{ marginTop: 10 }}>
                <TextField className="span-2" name="public_address" label={t.publicAddress} maxLength={300} defaultValue={p.public_address} errors={errors} required />
                <CheckField className="span-2" name="owner_authorized_address" label={t.ownerAuthorized} defaultChecked={p.exact_address_public} errors={errors} />
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
  const { d } = usePrivateI18n();
  return (
    <EditorForm propertyId={propertyId} step={3} live={live}>
      {(errors) => (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {d.editor.prices.intro}
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
  const { d } = usePrivateI18n();
  const t = d.editor.prices;
  const cur = { DOP: d.editor.form.currencyDOP, USD: d.editor.form.currencyUSD };
  return (
    <fieldset className="fieldset">
      <legend>{op === "venta" ? t.sale : t.rent}</legend>
      <div className="form-grid">
        <TextField name={n("amount")} label={op === "venta" ? t.amount : t.rentAmount} inputMode="decimal" defaultValue={str(p?.amount)} errors={errors}
          hint={t.amountHint} placeholder={t.amountPlaceholder} />
        <SelectField name={n("currency")} label={d.common.currency} required options={cur} defaultValue={p?.currency ?? (op === "venta" ? "USD" : "DOP")} errors={errors} />
        {op === "renta" ? (
          <SelectField name={n("rent_period")} label={t.period} options={t.rentPeriods} defaultValue={p?.rent_period ?? "mensual"} errors={errors} />
        ) : null}
        <CheckField name={n("negotiable")} label={t.negotiable} defaultChecked={p?.negotiable} errors={errors} />
        <TextField name={n("maintenance_amount")} label={t.maintenance} inputMode="decimal" defaultValue={str(p?.maintenance_amount)} errors={errors} hint={t.maintenanceHint} />
        <SelectField name={n("maintenance_currency")} label={t.maintenanceCurrency} options={cur} defaultValue={p?.maintenance_currency} placeholder={t.sameAsPrice} errors={errors} />
        <SelectField name={n("maintenance_included")} label={op === "renta" ? t.maintenanceIncludedRent : t.maintenanceIncluded} options={d.labels.tri} defaultValue={p?.maintenance_included ?? "desconocido"} errors={errors} />
        {op === "renta" ? (
          <>
            <TextField name={n("deposit_amount")} label={t.depositAmount} inputMode="decimal" defaultValue={str(p?.deposit_amount)} errors={errors} />
            <TextField name={n("deposit_months")} label={t.depositMonths} inputMode="decimal" defaultValue={str(p?.deposit_months)} errors={errors} />
            <TextField name={n("advance_months")} label={t.advanceMonths} inputMode="decimal" defaultValue={str(p?.advance_months)} errors={errors} />
            <TextField name={n("min_term_months")} label={t.minTerm} inputMode="numeric" defaultValue={str(p?.min_term_months)} errors={errors} />
          </>
        ) : null}
        <TextAreaField className="span-2" name={n("additional_costs")} label={t.additionalCosts} maxLength={1000} rows={3} defaultValue={p?.additional_costs} errors={errors} />
        <TextAreaField className="span-2" name={n("delivery_conditions")} label={t.deliveryConditions} maxLength={1000} rows={3} defaultValue={p?.delivery_conditions} errors={errors} />
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------
// 4. Distribución: valor / desconocido / no aplica
// ---------------------------------------------------------------------
type DistValues = Pick<EditorProperty, (typeof numericFieldKeys)[number] | (typeof spaceFieldKeys)[number] | "na_fields" | "roof_use_detail" | "property_type">;

export function StepDistribution({ propertyId, live, p }: StepProps & { p: DistValues }) {
  const { d } = usePrivateI18n();
  const t = d.editor.distribution;
  const modes = d.editor.numericModes;
  return (
    <EditorForm propertyId={propertyId} step={4} live={live}>
      {(errors) => (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {t.introBefore} <strong>{modes.valor}</strong> {t.introValue} <strong>{modes.desconocido}</strong> {t.introOr} <strong>{modes.no_aplica}</strong>.{" "}
            {fmt(t.introAfter, { type: d.labels.propertyTypes[p.property_type].toLowerCase() })}
          </p>
          <fieldset className="fieldset">
            <legend>{t.dimensions}</legend>
            <div className="le-num-grid">
              {numericFieldKeys.map((f) => (
                <NumericInput key={f} field={f} value={p[f]} mode={initialNumericMode(f, p[f], p.na_fields ?? [], p.property_type)} errors={errors} />
              ))}
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>{t.spaces}</legend>
            <div className="form-grid cols-3">
              {spaceFieldKeys.map((s) => (
                <SelectField key={s} name={s} label={d.labels.spaceFields[s]} options={d.labels.tri} defaultValue={initialSpaceValue(s, p[s], p.property_type)} errors={errors}
                  hint={!fieldApplies(p.property_type as PropertyType, s) ? t.usuallyNa : undefined} />
              ))}
              <TextAreaField className="span-3" name="roof_use_detail" label={t.roof} maxLength={500} rows={2} defaultValue={p.roof_use_detail} errors={errors}
                hint={t.roofHint} />
            </div>
          </fieldset>
        </>
      )}
    </EditorForm>
  );
}

function NumericInput({ field, value, mode: initial, errors }: { field: (typeof numericFieldKeys)[number]; value: number | string | null; mode: NumericMode; errors: Errors }) {
  const [mode, setMode] = useState<NumericMode>(initial);
  const { d } = usePrivateI18n();
  const def = NUMERIC_FIELDS[field];
  const label = d.labels.numericFields[field];
  const modes = d.editor.numericModes;
  const lim = NUMERIC_LIMITS[field];
  const groupId = `g-${field}`;
  return (
    <div className="le-num" role="group" aria-labelledby={groupId}>
      <span id={groupId} className="label">
        {label}{def.unit ? ` (${def.unit})` : ""}
      </span>
      <div className="le-modes">
        {(Object.keys(NUMERIC_MODES) as NumericMode[]).map((m) => (
          <label key={m} className="chip">
            <input type="radio" name={`${field}__modo`} value={m} checked={mode === m} onChange={() => setMode(m)} />
            {modes[m]}
          </label>
        ))}
      </div>
      <label htmlFor={`f-${field}`} className="sr-only">{fmt(d.editor.distribution.valueLabel, { label })}</label>
      <input
        id={`f-${field}`}
        name={field}
        className="input"
        inputMode={lim.int ? "numeric" : "decimal"}
        defaultValue={str(value)}
        disabled={mode !== "valor"}
        placeholder={mode === "valor" ? (lim.min < 0 ? d.editor.distribution.basementPlaceholder : d.editor.distribution.zeroValid) : modes[mode]}
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
  const { d } = usePrivateI18n();
  const t = d.editor.features;
  const groups = [
    { scope: "inmueble", title: t.own },
    { scope: "residencial", title: t.condo },
  ] as const;
  return (
    <EditorForm propertyId={propertyId} step={5} live={live}>
      {(errors) => (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {t.intro}
          </p>
          {groups.map((g) => (
            <fieldset key={g.scope} className="fieldset">
              <legend>{g.title}</legend>
              <div className="le-feature-grid">
                {featureKeys.filter((k) => FEATURES[k].scope === g.scope).map((k) => {
                  const cur = p.features?.[k];
                  return (
                    <div key={k} className="le-feature">
                      <SelectField name={`feat_${k}`} label={d.labels.features[k] ?? FEATURES[k].label} options={d.labels.tri} defaultValue={cur?.v ?? "desconocido"} errors={errors} />
                      <TextField name={`feat_${k}_detalle`} label={<span className="small muted">{t.detail}</span>} maxLength={200} defaultValue={cur?.d} errors={errors}
                        placeholder={FEATURES[k].detail ? d.editor.featureDetails[k] ?? FEATURES[k].detail : ""} />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <fieldset className="fieldset">
            <legend>{t.rules}</legend>
            <div className="form-grid">
              <TextAreaField className="span-2" name="condo_rules" label={t.condoRules} maxLength={3000} rows={4} defaultValue={p.condo_rules} errors={errors} />
              <TextAreaField className="span-2" name="restrictions" label={t.restrictions} maxLength={2000} rows={3} defaultValue={p.restrictions} errors={errors}
                hint={t.restrictionsHint} />
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
export function StepPrivate({ propertyId, live, priv, propertyType }: StepProps & { priv: EditorPrivate | null; propertyType: PropertyType }) {
  const v = priv ?? ({} as Partial<EditorPrivate>);
  const [exclusive, setExclusive] = useState(v.exclusivity === true ? "si" : v.exclusivity === false ? "no" : "");
  const { d } = usePrivateI18n();
  const t = d.editor.private;
  return (
    <EditorForm propertyId={propertyId} step={7} live={live}>
      {(errors) => (
        <>
          <p className="alert alert-info small" style={{ margin: 0 }}>
            {t.intro}
          </p>
          <fieldset className="fieldset">
            <legend>{t.owner}</legend>
            <div className="form-grid">
              <TextField name="owner_name" label={t.ownerName} maxLength={160} defaultValue={v.owner_name} errors={errors} autoComplete="off" />
              <TextField name="owner_phone" label={t.phone} type="tel" maxLength={40} defaultValue={v.owner_phone} errors={errors} autoComplete="off" />
              <TextField name="owner_email" label={t.email} type="email" maxLength={160} defaultValue={v.owner_email} errors={errors} autoComplete="off" />
              <SelectField name="owner_id_type" label={t.idType} options={d.editor.idTypes} defaultValue={v.owner_id_type} placeholder={d.editor.form.notSet} errors={errors} />
              <TextField name="owner_id_number" label={t.idNumber} maxLength={40} defaultValue={v.owner_id_number} errors={errors} autoComplete="off" />
              <SelectField name="publisher_relationship" label={t.relationship} options={d.editor.relationships} defaultValue={v.publisher_relationship} placeholder={d.editor.form.select} errors={errors} />
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>{t.authorization}</legend>
            <div className="form-grid">
              <CheckField className="span-2" name="publication_authorized" label={t.authorized} defaultChecked={v.publication_authorized} errors={errors}
                hint={t.authorizedHint} />
              <TextField name="authorization_date" type="date" label={t.authDate} defaultValue={v.authorization_date} errors={errors} />
              <TextField name="authorization_expires" type="date" label={t.authExpires} defaultValue={v.authorization_expires} errors={errors} />
              <TextAreaField className="span-2" name="commission_terms" label={t.commission} maxLength={1000} rows={2} defaultValue={v.commission_terms} errors={errors} />
              <div className="field">
                <label htmlFor="f-exclusivity">{t.exclusivity}</label>
                <select id="f-exclusivity" name="exclusivity" className="select" value={exclusive} onChange={(e) => setExclusive(e.currentTarget.value)} {...describedBy("exclusivity", errors)}>
                  <option value="">{d.editor.form.notSet}</option>
                  <option value="si">{t.exclusiveYes}</option>
                  <option value="no">{t.exclusiveNo}</option>
                </select>
                <FieldErr errors={errors} name="exclusivity" />
              </div>
              {exclusive === "si" ? (
                <TextField name="exclusivity_expires" type="date" label={t.exclusivityExpires} defaultValue={v.exclusivity_expires} errors={errors} />
              ) : null}
            </div>
          </fieldset>
          <fieldset className="fieldset">
            <legend>{t.legal}</legend>
            <p className="alert alert-warning small" style={{ marginTop: 0 }}>
              <strong>{t.legalWarningStrong}</strong> {t.legalWarning}
            </p>
            <div className="form-grid">
              {asksTitleInfo(propertyType) ? (
                <>
                  <TextField name="title_type" label={t.titleType} maxLength={120} defaultValue={v.title_type} errors={errors} placeholder={t.titleTypePlaceholder} />
                  <TextField name="title_registry_number" label={t.registry} maxLength={120} defaultValue={v.title_registry_number} errors={errors} />
                  <TextField name="cadastral_designation" label={t.cadastral} maxLength={160} defaultValue={v.cadastral_designation} errors={errors} />
                  <SelectField name="survey_status" label={t.survey} options={d.editor.surveyStatuses} defaultValue={v.survey_status} placeholder={d.editor.form.notSet} errors={errors} />
                  <TextField name="legal_status_certificate_date" type="date" label={t.certificateDate} defaultValue={v.legal_status_certificate_date} errors={errors} />
                </>
              ) : null}
              <TextAreaField className="span-2" name="declared_liens" label={t.liens} maxLength={2000} rows={2} defaultValue={v.declared_liens} errors={errors} />
              <TextAreaField className="span-2" name="tax_notes" label={t.taxNotes} maxLength={2000} rows={2} defaultValue={v.tax_notes} errors={errors} />
              <TextAreaField className="span-2" name="contract_notes" label={t.contractNotes} maxLength={2000} rows={2} defaultValue={v.contract_notes} errors={errors} />
            </div>
          </fieldset>
        </>
      )}
    </EditorForm>
  );
}
