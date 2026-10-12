"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "otro";

const noop = () => () => {};
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/i.test(ua) ? "android" : "otro";
}
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

/** Botón para instalar la app (Android y computadoras) e instrucciones para iPhone. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const platform = useSyncExternalStore<Platform>(noop, detectPlatform, () => "otro");
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const [justInstalled, setInstalled] = useState(false);
  const installed = standalone || justInstalled;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="alert alert-success">La app ya está instalada en este dispositivo.</p>;

  return (
    <div className="stack">
      {prompt ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          Instalar la app
        </button>
      ) : null}
      {platform === "ios" ? (
        <ol className="stack">
          <li>Abra esta página en <strong>Safari</strong>.</li>
          <li>Toque el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
          <li>Elija <strong>Agregar a pantalla de inicio</strong> y toque <strong>Agregar</strong>.</li>
        </ol>
      ) : !prompt ? (
        <ol className="stack">
          <li>Abra esta página en <strong>Chrome</strong>.</li>
          <li>Toque el menú <strong>⋮</strong> arriba a la derecha.</li>
          <li>Elija <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.</li>
        </ol>
      ) : null}
    </div>
  );
}
