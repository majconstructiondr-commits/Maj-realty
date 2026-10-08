// Calculadora hipotecaria ORIENTATIVA. No incluye seguros, comisiones ni cargos no suministrados.
// No representa aprobación ni tasas vigentes de ninguna entidad.
export type MortgageInput = { price: number; downPayment: number; annualRatePct: number; years: number };

export function mortgage({ price, downPayment, annualRatePct, years }: MortgageInput) {
  const principal = price - downPayment;
  if (!(price > 0) || downPayment < 0 || principal <= 0 || !(years > 0) || years > 40 || annualRatePct < 0 || annualRatePct > 60) {
    return null;
  }
  const n = Math.round(years * 12);
  const r = annualRatePct / 100 / 12;
  const payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const total = payment * n;
  return {
    principal: round2(principal),
    months: n,
    monthlyPayment: round2(payment),
    totalPaid: round2(total),
    totalInterest: round2(total - principal),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
