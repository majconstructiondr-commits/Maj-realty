import Link from "next/link";
import { labelOf, toneOf } from "@/lib/admin/labels";
import { hrefWith, type SP } from "@/lib/admin/params";
import { formatMoney, type Currency } from "@/lib/format";

export function Badge({ value, map }: { value: string | null | undefined; map?: Record<string, string> }) {
  const tone = toneOf(value);
  const cls = tone === "neutral" ? "badge" : `badge badge-${tone}`;
  return <span className={cls}>{map ? labelOf(map, value) : value ?? "—"}</span>;
}

export function Pagination({ base, sp, page, total, pageSize }: { base: string; sp: SP; page: number; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="small muted">{total} resultado{total === 1 ? "" : "s"}</p>;
  const around = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  return (
    <nav className="pagination" aria-label="Paginación">
      {page > 1 && <Link href={hrefWith(base, sp, { pagina: page - 1 })}>‹ Anterior</Link>}
      {around.map((p) =>
        p === page ? <span key={p} aria-current="page">{p}</span> : <Link key={p} href={hrefWith(base, sp, { pagina: p })}>{p}</Link>,
      )}
      {page < pages && <Link href={hrefWith(base, sp, { pagina: page + 1 })}>Siguiente ›</Link>}
      <span className="small muted" style={{ border: 0 }}>{total} resultados</span>
    </nav>
  );
}

/** Encabezado de columna ordenable (alterna asc/desc). */
export function SortTh({ base, sp, column, current, children }: { base: string; sp: SP; column: string; current: string; children: React.ReactNode }) {
  const active = current === column || current === `-${column}`;
  const next = current === column ? `-${column}` : column;
  return (
    <th aria-sort={active ? (current.startsWith("-") ? "descending" : "ascending") : undefined}>
      <Link href={hrefWith(base, sp, { orden: next, pagina: undefined })}>
        {children} {active ? (current.startsWith("-") ? "↓" : "↑") : ""}
      </Link>
    </th>
  );
}

/** Descarga de archivo privado mediante enlace firmado de corta duración (se genera al hacer clic). */
export function FileLink({ path, children, bucket = "private-docs" }: { path: string; children: React.ReactNode; bucket?: "private-docs" | "property-media" }) {
  return (
    <a href={`/api/admin/archivo?bucket=${bucket}&path=${encodeURIComponent(path)}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Importes agrupados por moneda (nunca se suman DOP y USD). */
export function MoneyByCurrency({ totals, empty = "Sin importes" }: { totals: Partial<Record<Currency, number | string>>; empty?: string }) {
  const entries = (Object.entries(totals) as [Currency, number | string][]).filter(([, v]) => v !== undefined && v !== null);
  if (!entries.length) return <span className="muted">{empty}</span>;
  return (
    <span className="stack" style={{ display: "grid", gap: 2 }}>
      {entries.map(([c, v]) => <span key={c}>{formatMoney(Number(v), c, { decimals: true })}</span>)}
    </span>
  );
}

/** Detalles JSON como cajas con etiqueta. */
export function DetailBoxes({ data, labels = {} }: { data: Record<string, unknown>; labels?: Record<string, string> }) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return <p className="muted small">Sin detalles adicionales.</p>;
  const show = (v: unknown) =>
    typeof v === "boolean" ? (v ? "Sí" : "No") : Array.isArray(v) ? v.map((x) => labels[String(x)] ?? String(x)).join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return (
    <div className="grid-3">
      {entries.map(([k, v]) => (
        <div className="box" key={k}>
          <span className="box-label">{labels[k] ?? k.replace(/_/g, " ")}</span>
          <span className="box-value" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{show(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function SubNav({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav aria-label="Secciones">
      <ul className="stepper">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={i.href === current ? "step" : undefined}>{i.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, children, back }: { title: string; children?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="stack" style={{ marginBottom: 16 }}>
      {back && <Link href={back.href} className="small">← {back.label}</Link>}
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{title}</h1>
        {children && <div className="row">{children}</div>}
      </div>
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty card">{children}</p>;
}

/** Selector simple con opciones de un mapa de etiquetas. */
export function Options({ map, empty }: { map: Record<string, string>; empty?: string }) {
  return (
    <>
      {empty !== undefined && <option value="">{empty}</option>}
      {Object.entries(map).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </>
  );
}

/** Enlace de descarga (CSV) servido por una ruta API; no es navegación de página. */
export function ExportLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="btn btn-ghost btn-sm" href={href} download>{children}</a>;
}
