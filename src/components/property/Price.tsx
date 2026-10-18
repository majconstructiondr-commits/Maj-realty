import { formatMoney, type Currency } from "@/lib/format";
import { es, type Dictionary } from "@/i18n/es";

export function PriceLine({
  label,
  amount,
  currency,
  negotiable,
  period,
  d = es,
}: {
  label?: string;
  amount: string | null;
  currency: Currency | null;
  negotiable?: boolean | null;
  period?: string | null;
  d?: Dictionary;
}) {
  if (!currency) return null;
  return (
    <div className="listing-price">
      {label ? <small style={{ display: "block" }}>{label}</small> : null}
      {formatMoney(amount, currency, { onRequest: d.common.priceOnRequest })}
      {period && amount ? <small> / {d.labels.rentPeriodShort[period] ?? period}</small> : null}
      {negotiable ? <small> · {d.card.negotiable}</small> : null}
    </div>
  );
}
