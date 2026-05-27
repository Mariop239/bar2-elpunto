import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v as number) ? (v as number) : 0);
}

/**
 * Redondea estrictamente a 2 decimales para evitar errores de punto flotante
 * antes de persistir valores monetarios en la base de datos.
 */
export function round2(n: number | string | null | undefined): number {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v as number)) return 0;
  return Math.round((v as number) * 100) / 100;
}
