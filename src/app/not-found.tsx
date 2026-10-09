import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section center">
      <h1>No encontramos esta página</h1>
      <p className="muted">Puede que el inmueble ya no esté publicado o que el enlace haya cambiado.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary" href="/venta">Ver inmuebles en venta</Link>
        <Link className="btn btn-outline" href="/renta">Ver inmuebles en renta</Link>
      </div>
    </div>
  );
}
