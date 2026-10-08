import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { ilikeTerm, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { deleteContentBlock, saveContentBlock } from "./actions";

type Block = { key: string; locale: string; title: string | null; body: string; updated_by: string | null; updated_at: string };

export default async function AdminContent(props: PageProps<"/admin/contenido">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx("/admin/contenido");
  const term = ilikeTerm(str(sp, "q"));
  let q = supabase.from("content_blocks").select("*").order("key").order("locale").limit(300);
  if (term) q = q.or(`key.ilike.%${term}%,title.ilike.%${term}%`);
  const { data, error } = await q;
  const rows = (data ?? []) as Block[];
  const people = await userLabels(supabase, rows.map((r) => r.updated_by));
  return (
    <>
      <PageHeader title="Contenido y portafolio" />
      <ContentTabs current="/admin/contenido" />
      <p className="small muted">Textos editables del sitio identificados por clave (p. ej. <code>home.hero</code>). Si un texto no existe, el sitio usa su texto por defecto.</p>
      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>+ Nuevo texto</strong></summary>
        <ActionForm action={saveContentBlock} submit="Guardar texto" resetOnSuccess>
          <BlockFields />
        </ActionForm>
      </details>
      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <input name="q" className="input" defaultValue={str(sp, "q")} placeholder="Buscar por clave o título" aria-label="Buscar" style={{ maxWidth: 320 }} />
        <button className="btn btn-ghost btn-sm" type="submit">Buscar</button>
      </form>
      {error && <p className="alert alert-error">No se pudieron cargar los textos.</p>}
      {rows.length === 0 ? <p className="empty card">No hay textos personalizados.</p> : rows.map((b) => (
        <details key={`${b.key}-${b.locale}`} className="card card-body" style={{ marginBottom: 8 }}>
          <summary><strong>{b.key}</strong> · {b.locale.toUpperCase()} {b.title && `· ${b.title}`} <span className="xs muted">· {formatDate(b.updated_at, true)} · {labelFor(people, b.updated_by, "—")}</span></summary>
          <ActionForm action={saveContentBlock} submit="Guardar">
            <BlockFields b={b} />
          </ActionForm>
          <ActionForm action={deleteContentBlock} submit="Eliminar" buttonClass="btn btn-ghost btn-sm" confirm="¿Eliminar este texto? Se usará el texto por defecto.">
            <input type="hidden" name="key" value={b.key} /><input type="hidden" name="locale" value={b.locale} />
          </ActionForm>
        </details>
      ))}
    </>
  );
}

function BlockFields({ b }: { b?: Block }) {
  const k = b ? `${b.key}-${b.locale}` : "new";
  return (
    <>
      <div className="form-grid">
        <div className="field"><label htmlFor={`k-${k}`} className="required">Clave</label><input id={`k-${k}`} name="key" className="input" required pattern="[a-z0-9_.\-]{2,80}" defaultValue={b?.key ?? ""} readOnly={Boolean(b)} /></div>
        <div className="field"><label htmlFor={`l-${k}`}>Idioma</label>
          {b ? <input id={`l-${k}`} name="locale" className="input" value={b.locale} readOnly /> : <select id={`l-${k}`} name="locale" className="select"><option value="es">Español</option><option value="en">Inglés</option></select>}
        </div>
        <div className="field"><label htmlFor={`t-${k}`}>Título</label><input id={`t-${k}`} name="title" className="input" maxLength={200} defaultValue={b?.title ?? ""} /></div>
      </div>
      <div className="field"><label htmlFor={`b-${k}`}>Texto</label><textarea id={`b-${k}`} name="body" className="textarea" rows={6} maxLength={20000} defaultValue={b?.body ?? ""} /><span className="hint">Texto plano. No incluya datos sin confirmar (teléfonos, precios, promesas).</span></div>
    </>
  );
}
