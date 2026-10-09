// Campos accesibles reutilizables del editor (etiqueta, ayuda y error asociados al control).
import type { ReactNode } from "react";

export type Errors = Record<string, string> | undefined;

export function describedBy(name: string, errors: Errors, hint?: boolean) {
  const ids = [hint ? `${name}-hint` : "", errors?.[name] ? `${name}-error` : ""].filter(Boolean).join(" ");
  return {
    "aria-invalid": errors?.[name] ? (true as const) : undefined,
    "aria-describedby": ids || undefined,
  };
}

export function FieldErr({ errors, name }: { errors: Errors; name: string }) {
  if (!errors?.[name]) return null;
  return (
    <span className="error" id={`${name}-error`}>
      {errors[name]}
    </span>
  );
}

type Base = { name: string; label: ReactNode; errors?: Errors; hint?: ReactNode; required?: boolean; className?: string; id?: string };

export function TextField({
  name, label, errors, hint, required, className, id, defaultValue, type = "text", maxLength, ...rest
}: Base & { defaultValue?: string | number | null; type?: string; maxLength?: number; placeholder?: string; inputMode?: "text" | "decimal" | "numeric" | "tel" | "email" | "url"; autoComplete?: string; min?: string | number; max?: string | number; step?: string | number; disabled?: boolean }) {
  const fid = id ?? `f-${name}`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={fid} className={required ? "required" : undefined}>{label}</label>
      <input
        id={fid}
        name={name}
        type={type}
        className="input"
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={maxLength}
        {...rest}
        {...describedBy(name, errors, Boolean(hint))}
      />
      {hint ? <span className="hint" id={`${name}-hint`}>{hint}</span> : null}
      <FieldErr errors={errors} name={name} />
    </div>
  );
}

export function TextAreaField({
  name, label, errors, hint, required, className, id, defaultValue, maxLength, rows,
}: Base & { defaultValue?: string | null; maxLength?: number; rows?: number }) {
  const fid = id ?? `f-${name}`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={fid} className={required ? "required" : undefined}>{label}</label>
      <textarea
        id={fid}
        name={name}
        className="textarea"
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={maxLength}
        rows={rows}
        {...describedBy(name, errors, Boolean(hint))}
      />
      {hint ? <span className="hint" id={`${name}-hint`}>{hint}</span> : null}
      <FieldErr errors={errors} name={name} />
    </div>
  );
}

export function SelectField({
  name, label, errors, hint, required, className, id, defaultValue, options, placeholder,
}: Base & { defaultValue?: string | null; options: Record<string, string> | readonly string[]; placeholder?: string }) {
  const fid = id ?? `f-${name}`;
  const entries = Array.isArray(options) ? (options as readonly string[]).map((o) => [o, o] as const) : Object.entries(options);
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={fid} className={required ? "required" : undefined}>{label}</label>
      <select id={fid} name={name} className="select" defaultValue={defaultValue ?? ""} required={required} {...describedBy(name, errors, Boolean(hint))}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {entries.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      {hint ? <span className="hint" id={`${name}-hint`}>{hint}</span> : null}
      <FieldErr errors={errors} name={name} />
    </div>
  );
}

export function CheckField({
  name, label, errors, hint, className, defaultChecked, id, onChange, required,
}: Base & { defaultChecked?: boolean; onChange?: (checked: boolean) => void }) {
  const fid = id ?? `f-${name}`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label className="check" htmlFor={fid} style={{ fontWeight: 500 }}>
        <input
          id={fid}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          required={required}
          onChange={onChange ? (e) => onChange(e.currentTarget.checked) : undefined}
          {...describedBy(name, errors, Boolean(hint))}
        />
        <span>{label}</span>
      </label>
      {hint ? <span className="hint" id={`${name}-hint`}>{hint}</span> : null}
      <FieldErr errors={errors} name={name} />
    </div>
  );
}

export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
