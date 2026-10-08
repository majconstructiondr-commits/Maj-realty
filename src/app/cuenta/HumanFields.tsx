"use client";
import { useEffect, useState } from "react";
import { env } from "@/lib/env";
import { Turnstile } from "@/components/forms/Turnstile";

/** Campo trampa, marca de tiempo y Turnstile opcional (verificados por checkHuman en el servidor). */
export function HumanFields() {
  const [started, setStarted] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca de tiempo solo en el cliente
    setStarted(Date.now());
  }, []);
  return (
    <>
      <input type="hidden" name="_t" value={started || ""} />
      <div className="honeypot" aria-hidden="true">
        <label>
          No llenar este campo <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {env.turnstileSiteKey ? <Turnstile siteKey={env.turnstileSiteKey} /> : null}
    </>
  );
}
