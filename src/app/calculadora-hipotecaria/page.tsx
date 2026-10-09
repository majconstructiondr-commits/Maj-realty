import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { MortgageCalculator } from "@/components/forms/MortgageCalculator";

export const metadata: Metadata = { title: "Calculadora hipotecaria", description: "Calcula una cuota mensual orientativa.", alternates: { canonical: "/calculadora-hipotecaria" } };

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Herramienta" title="Calculadora hipotecaria" lead="Estimación orientativa de la cuota mensual con los datos que introduzcas." />
      <div className="container section" style={{ maxWidth: 860 }}>
        <MortgageCalculator />
      </div>
    </>
  );
}
