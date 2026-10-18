// Servicios de la portada. key enlaza con los textos de i18n (services); `service` va en la plantilla de WhatsApp (español).
export const SERVICES = [
  { key: "venta", href: "/venta", icon: "home", title: "Venta", text: "Compra o vende con acompañamiento: captación, visitas y seguimiento de interesados.", service: "la venta de un inmueble" },
  { key: "renta", href: "/renta", icon: "key", title: "Renta", text: "Publica tu inmueble en renta o encuentra el tuyo. Coordinamos visitas y evaluación documental.", service: "la renta de un inmueble" },
  { key: "administracion", href: "/administracion", icon: "building", title: "Administración", text: "Gestión de inmuebles en renta con portal del propietario, mantenimiento y estados de cuenta.", service: "el servicio de administración" },
  { key: "remodelaciones", href: "/remodelaciones", icon: "tools", title: "Remodelaciones", text: "Solicita una visita técnica para evaluar tu proyecto de remodelación.", service: "una remodelación" },
  { key: "cotizaciones", href: "/cotizaciones", icon: "doc", title: "Cotizaciones", text: "Presupuestos preparados por personal autorizado, con partidas, vigencia y condiciones.", service: "una cotización" },
  { key: "legal", href: "/gestiones-legales", icon: "scale", title: "Gestiones legales", text: "Revisión de títulos, contratos y otras gestiones con profesionales responsables.", service: "gestiones legales de propiedades" },
] as const;
