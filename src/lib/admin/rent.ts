// Textos y enlaces del cobro de rentas (personal de MAJ).
import { env } from "@/lib/env";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export const CHARGE_STATUSES = { pendiente: "Pendiente", en_revision: "Pago en revisión", pagado: "Pagado", anulado: "Anulado" } as const;
export const RENT_PAYMENT_STATUSES = { pendiente: "Por revisar", confirmado: "Confirmado", rechazado: "Rechazado" } as const;
export const RENT_METHODS = { transferencia: "Transferencia", deposito: "Depósito", efectivo: "Efectivo (en oficina)", otro: "Otro" } as const;

/** Enlace de WhatsApp con el aviso de renta para el inquilino (abrirlo no envía nada por sí solo). */
export function rentReminderLink(phone: string, c: { period: string; amount: number; currency: Currency; due_date: string }, overdue: boolean) {
  const monto = formatMoney(c.amount, c.currency, { decimals: true });
  const text = overdue
    ? `Hola, le saluda MAJ REALTY. Su renta de ${c.period} (${monto}) venció el ${formatDate(c.due_date)}. Si ya pagó, suba el comprobante en ${env.siteUrl}/panel/rentas. Gracias.`
    : `Hola, le saluda MAJ REALTY. Le recordamos su renta de ${c.period} por ${monto}, con vencimiento el ${formatDate(c.due_date)}. Puede ver los datos de pago y subir el comprobante en ${env.siteUrl}/panel/rentas.`;
  return whatsappLink(phone, text);
}
