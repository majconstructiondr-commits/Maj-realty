"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container section center" role="alert">
      <h1>Algo salió mal</h1>
      <p className="muted">No pudimos cargar esta sección. Si estaba enviando un formulario, no se confirmó el envío.</p>
      <button className="btn btn-primary" onClick={reset}>Intentar de nuevo</button>
    </div>
  );
}
