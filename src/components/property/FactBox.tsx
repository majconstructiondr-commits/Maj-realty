import { TRI, type Tri } from "@/lib/catalog/definitions";
import { formatNumber } from "@/lib/format";

/** Muestra un dato distinguiendo cero, desconocido y no aplica. */
export function FactBox({ label, value, unit, na }: { label: string; value: number | string | null | undefined; unit?: string; na?: boolean }) {
  let text: string;
  let unknown = false;
  if (na) {
    text = "No aplica";
    unknown = true;
  } else if (value === null || value === undefined || value === "") {
    text = "Desconocido";
    unknown = true;
  } else {
    text = `${typeof value === "number" || /^-?\d+(\.\d+)?$/.test(String(value)) ? formatNumber(value, 2) : value}${unit ? ` ${unit}` : ""}`;
  }
  return (
    <div className="box">
      <span className="box-label">{label}</span>
      <span className={`box-value${unknown ? " unknown" : ""}`}>{text}</span>
    </div>
  );
}

export function TriBox({ label, value, detail }: { label: string; value: Tri; detail?: string | null }) {
  return (
    <div className="box feature-card">
      <span className={`feature-dot dot-${value}`} aria-hidden="true" />
      <span>
        <span className="box-label">{label}</span>
        <span className={`box-value${value === "desconocido" || value === "no_aplica" ? " unknown" : ""}`}>{TRI[value]}</span>
        {detail ? <span className="small muted">{detail}</span> : null}
      </span>
    </div>
  );
}
