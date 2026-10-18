"use client";
import { useFormStatus } from "react-dom";
import { setLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { locales, LOCALE_COOKIE } from "@/i18n/index";

function LangButton({ code, name, current }: { code: string; name: string; current: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={LOCALE_COOKIE}
      value={code}
      lang={code}
      className="lang-btn"
      aria-pressed={current}
      disabled={pending}
    >
      {code.toUpperCase()}
      <span className="sr-only"> · {name}</span>
    </button>
  );
}

/** Selector de idioma "ES | EN". Funciona también sin JavaScript (formulario con acción de servidor). */
export function LanguageSwitcher() {
  const { locale, d } = useI18n();
  return (
    <form action={setLocale} className="lang-switch" role="group" aria-label={d.header.language}>
      {locales.map((code, i) => (
        <span key={code} className="row" style={{ gap: 0, flexWrap: "nowrap" }}>
          {i > 0 ? <span className="lang-sep" aria-hidden="true">|</span> : null}
          <LangButton code={code} name={d.header.languageNames[code]} current={locale === code} />
        </span>
      ))}
    </form>
  );
}
