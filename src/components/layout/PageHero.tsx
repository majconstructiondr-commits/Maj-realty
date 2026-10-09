export function PageHero({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <section className="hero page-hero">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 36 }}>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}
