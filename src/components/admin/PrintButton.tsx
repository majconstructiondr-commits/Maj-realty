"use client";
import { usePrivateI18n } from "@/i18n/client";

export function PrintButton({ label }: { label?: string }) {
  const { d } = usePrivateI18n();
  return (
    <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
      {label ?? d.admin.common.print}
    </button>
  );
}
