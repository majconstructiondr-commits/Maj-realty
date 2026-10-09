// Vista previa de cómo se verá la publicación (mismos criterios que la ficha pública:
// cero ≠ desconocido ≠ no aplica; solo la zona aproximada). Usa consultas de contenedor
// para que el marco de móvil se vea como en un teléfono.
import {
  CONDITIONS, FEATURES, NUMERIC_FIELDS, PROPERTY_TYPES, SPACE_FIELDS, fieldApplies, type NumericField, type SpaceField,
} from "@/lib/catalog/definitions";
import type { CatalogMedia } from "@/lib/catalog/types";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { EditorMedia, EditorPrice, EditorProperty } from "@/lib/listing-editor/types";
import { FactBox, TriBox } from "@/components/property/FactBox";
import { Gallery } from "@/components/property/Gallery";

export function ListingPreview({ p, prices, media, idSuffix }: { p: EditorProperty; prices: EditorPrice[]; media: EditorMedia[]; idSuffix: string }) {
  const na = new Set(p.na_fields ?? []);
  const sorted = [...media].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  const gallery: CatalogMedia[] = sorted.map((m) => ({
    id: m.id, property_id: p.id, kind: m.kind, storage_path: m.storage_path, external_url: m.external_url, alt_text: m.alt_text,
    sort_order: m.sort_order, is_cover: m.is_cover, url: m.url ?? null,
  }));
  const feats = Object.entries(FEATURES).map(([k, d]) => ({ k, d, v: p.features?.[k] }));
  const own = feats.filter((f) => f.d.scope === "inmueble" && f.v);
  const condo = feats.filter((f) => f.d.scope === "residencial" && f.v);
  const tours = media.filter((m) => m.kind === "video" || m.kind === "recorrido");
  const h = (s: string) => `${s}-${idSuffix}`;
  const visiblePrices = prices.filter((x) => p.operation === "ambas" || x.operation === p.operation);

  return (
    <article className="le-preview" aria-label="Vista previa de la publicación">
      <span className="eyebrow">{PROPERTY_TYPES[p.property_type]} · Ref. {p.code}</span>
      <h2 style={{ marginBottom: 6 }}>{p.title}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {[p.sector, p.municipality, p.province].filter(Boolean).join(", ") || "Ubicación sin indicar"} (ubicación aproximada)
        {p.condition ? <> · {CONDITIONS[p.condition as keyof typeof CONDITIONS]}</> : null}
      </p>
      <Gallery media={gallery} title={p.title} />

      {visiblePrices.length ? (
        visiblePrices.map((x) => (
          <section key={x.operation} className="card card-body le-sec" aria-labelledby={h(`pv-precio-${x.operation}`)}>
            <h3 id={h(`pv-precio-${x.operation}`)}>{x.operation === "venta" ? "Precio de venta" : "Precio de renta"}</h3>
            <div className="le-facts">
              <FactBox label="Importe" value={x.amount !== null && x.amount !== "" ? formatMoney(x.amount, x.currency) + (x.operation === "renta" && x.rent_period ? ` / ${x.rent_period}` : "") : "Precio a consultar"} />
              <FactBox label="Negociable" value={x.negotiable ? "Sí" : "No"} />
              <FactBox label="Mantenimiento" value={x.maintenance_amount && x.maintenance_currency ? formatMoney(x.maintenance_amount, x.maintenance_currency) : null} />
              {x.operation === "renta" ? (
                <>
                  <FactBox label="Depósito" value={x.deposit_amount ? formatMoney(x.deposit_amount, x.currency) : x.deposit_months ? `${formatNumber(x.deposit_months, 1)} mes(es)` : null} />
                  <FactBox label="Plazo mínimo" value={x.min_term_months !== null && x.min_term_months !== undefined ? `${x.min_term_months} meses` : null} />
                </>
              ) : null}
            </div>
          </section>
        ))
      ) : (
        <p className="alert alert-warning small">Sin precio registrado todavía.</p>
      )}

      <section className="card card-body le-sec" aria-labelledby={h("pv-dist")}>
        <h3 id={h("pv-dist")}>Dimensiones y distribución</h3>
        <div className="le-facts">
          {(Object.keys(NUMERIC_FIELDS) as NumericField[]).map((k) => {
            const v = p[k];
            if (na.has(k) || (!fieldApplies(p.property_type, k) && (v === null || v === undefined))) return <FactBox key={k} label={NUMERIC_FIELDS[k].label} value={null} na />;
            return <FactBox key={k} label={NUMERIC_FIELDS[k].label} value={v} unit={NUMERIC_FIELDS[k].unit} />;
          })}
        </div>
        <h3 style={{ marginTop: 16 }}>Espacios</h3>
        <div className="le-facts">
          {(Object.keys(SPACE_FIELDS) as SpaceField[]).map((k) => (
            <TriBox key={k} label={SPACE_FIELDS[k]} value={!fieldApplies(p.property_type, k) && p[k] === "desconocido" ? "no_aplica" : p[k]} detail={k === "roof_area" ? p.roof_use_detail : null} />
          ))}
        </div>
      </section>

      {own.length || condo.length ? (
        <section className="card card-body le-sec" aria-labelledby={h("pv-car")}>
          <h3 id={h("pv-car")}>Características</h3>
          {own.length ? (
            <>
              <p className="small muted" style={{ margin: "6px 0" }}>Del inmueble</p>
              <div className="le-facts">{own.map((f) => <TriBox key={f.k} label={f.d.label} value={f.v!.v} detail={f.v!.d} />)}</div>
            </>
          ) : null}
          {condo.length ? (
            <>
              <p className="small muted" style={{ margin: "14px 0 6px" }}>Del residencial o edificio</p>
              <div className="le-facts">{condo.map((f) => <TriBox key={f.k} label={f.d.label} value={f.v!.v} detail={f.v!.d} />)}</div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="card card-body le-sec" aria-labelledby={h("pv-desc")}>
        <h3 id={h("pv-desc")}>Descripción</h3>
        <div style={{ whiteSpace: "pre-line" }}>{p.description || <span className="muted">Sin descripción.</span>}</div>
        {p.condo_rules ? (<><h3 style={{ marginTop: 16 }}>Reglas del condominio</h3><p style={{ whiteSpace: "pre-line" }}>{p.condo_rules}</p></>) : null}
        {p.restrictions ? (<><h3>Restricciones</h3><p style={{ whiteSpace: "pre-line" }}>{p.restrictions}</p></>) : null}
        <div className="le-facts" style={{ marginTop: 12 }}>
          <FactBox label="Disponible desde" value={p.available_from ? formatDate(p.available_from) : null} />
        </div>
      </section>

      {tours.length ? (
        <section className="card card-body le-sec">
          <h3>Video y recorrido virtual</h3>
          <ul>
            {tours.map((m) => (
              <li key={m.id}>{m.kind === "video" ? "Video" : "Recorrido virtual"}: {m.alt_text}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card card-body le-sec" aria-labelledby={h("pv-ubic")}>
        <h3 id={h("pv-ubic")}>Ubicación</h3>
        <div className="le-facts">
          <FactBox label="Provincia" value={p.province} />
          <FactBox label="Municipio" value={p.municipality} />
          <FactBox label="Sector" value={p.sector} />
          {p.exact_address_public && p.public_address ? <FactBox label="Dirección (autorizada por el propietario)" value={p.public_address} /> : null}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>
          {p.approx_lat && p.approx_lng ? "Se mostrará un mapa con una zona aproximada." : "Sin coordenadas: no se mostrará mapa."} La dirección exacta no se publica.
        </p>
      </section>
    </article>
  );
}
