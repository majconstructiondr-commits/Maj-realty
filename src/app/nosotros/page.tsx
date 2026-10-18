import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getTeam } from "@/lib/team";
import { getContentBlock } from "@/lib/content";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.about.meta, alternates: { canonical: "/nosotros" } };
}

export default async function Page() {
  const [s, team, block, { d }] = await Promise.all([getSiteSettings(), getTeam(), getContentBlock("nosotros"), getI18n()]);
  const t = d.about;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={block?.title ?? "MAJ REALTY SRL"} lead={t.lead} />
      <div className="container section" style={{ maxWidth: 900 }}>
        {block?.body ? (
          <div style={{ whiteSpace: "pre-line" }}>{block.body}</div>
        ) : (
          <div className="stack">
            <p className="lead">{t.body}</p>
            <p className="muted small">{t.pending}</p>
          </div>
        )}
        {team.length ? (
          <>
            <h2 style={{ marginTop: 32 }}>{t.team}</h2>
            <div className="grid-3">
              {team.map((m) => (
                <div key={m.id} className="card card-body center">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.display_name} style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px" }} />
                  ) : null}
                  <strong>{m.display_name}</strong>
                  {m.title ? <p className="small muted" style={{ margin: 0 }}>{m.title}</p> : null}
                  {m.bio ? <p className="small" style={{ marginTop: 8 }}>{m.bio}</p> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div style={{ marginTop: 32 }}><ContactButtons s={s} d={d} servicio="sus servicios" /></div>
      </div>
    </>
  );
}
