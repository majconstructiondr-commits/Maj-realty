// Enlaces de WhatsApp (https://faq.whatsapp.com/5913398998672934).
// Abrir el enlace NO equivale a un mensaje enviado ni a un contacto confirmado.

export function normalizeWhatsappNumber(n: string) {
  const digits = (n ?? "").replace(/\D/g, "");
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) return `1${digits}`;
  return digits;
}

export function fillTemplate(template: string, vars: { servicio?: string; codigo?: string; url?: string }) {
  let text = template;
  text = text.replace("{servicio}", vars.servicio ?? "sus servicios");
  if (vars.codigo) text = text.replace("{codigo}", vars.codigo);
  else text = text.replace(/,?\s*referencia \{codigo\}/, "");
  if (vars.url) text = text.replace("{url}", vars.url);
  else text = text.replace(/,?\s*enlace \{url\}/, "");
  return text.trim();
}

export function whatsappLink(number: string, text?: string) {
  const n = normalizeWhatsappNumber(number);
  const base = `https://wa.me/${n}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
