"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "otro";

const noop = () => () => {};
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/i.test(ua) ? "android" : "otro";
}
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

/** Pasos con partes en negrita: los elementos impares de cada paso van en <strong>. */
function Steps({ steps }: { steps: string[][] }) {
  return (
    <ol className="stack">
      {steps.map((parts, i) => (
        <li key={i}>{parts.map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p))}</li>
      ))}
    </ol>
  );
}

/** Botón para instalar la app (Android y computadoras) e instrucciones para iPhone. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const { d } = useI18n();
  const t = d.app;
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

  if (installed) return <p className="alert alert-success">{t.installed}</p>;

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
          {t.installButton}
        </button>
      ) : null}
      {platform === "ios" ? (
        <Steps steps={t.ios} />
      ) : !prompt ? (
        <Steps steps={t.android} />
      ) : null}
    </div>
  );
}
