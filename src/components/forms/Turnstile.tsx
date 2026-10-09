"use client";
import Script from "next/script";

/** Cloudflare Turnstile (opcional). Se activa con NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY. */
export function Turnstile({ siteKey }: { siteKey: string }) {
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="es" />
    </>
  );
}
