import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { MortgageCalculator } from "@/components/forms/MortgageCalculator";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.mortgage.meta, alternates: { canonical: "/calculadora-hipotecaria" } };
}

export default async function Page() {
  const { d } = await getI18n();
  const t = d.mortgage;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section" style={{ maxWidth: 860 }}>
        <MortgageCalculator />
      </div>
    </>
  );
}
