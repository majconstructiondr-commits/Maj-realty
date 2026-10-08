import { formatMoney, type Currency } from "@/lib/format";

export function PriceLine({
  label,
  amount,
  currency,
  negotiable,
  period,
}: {
  label?: string;
  amount: string | null;
  currency: Currency | null;
  negotiable?: boolean | null;
  period?: string | null;
}) {
  if (!currency) return null;
  return (
    <div className="listing-price">
      {label ? <small style={{ display: "block" }}>{label}</small> : null}
      {formatMoney(amount, currency)}
      {period && amount ? <small> / {period === "mensual" ? "mes" : period}</small> : null}
      {negotiable ? <small> · negociable</small> : null}
    </div>
  );
}
