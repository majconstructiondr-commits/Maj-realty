import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { d } = await getI18n();
  const t = d.notFound;
  return (
    <div className="container section center">
      <h1>{t.title}</h1>
      <p className="muted">{t.text}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary" href="/venta">{t.sale}</Link>
        <Link className="btn btn-outline" href="/renta">{t.rent}</Link>
      </div>
    </div>
  );
}
