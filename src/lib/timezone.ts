import { format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

// El Salvador timezone (CST = UTC-6)
export const TZ_CST = "America/El_Salvador";

/**
 * Format a UTC date to CST display string
 */
export function formatCST(
  date: string | Date,
  formatStr: string = "dd/MM/yyyy HH:mm"
): string {
  return formatInTimeZone(date, TZ_CST, formatStr, { locale: es });
}

/**
 * Format a UTC date to CST date only
 */
export function formatCSTDate(date: string | Date): string {
  return formatInTimeZone(date, TZ_CST, "dd/MM/yyyy", { locale: es });
}

/**
 * Format a UTC date to CST time only
 */
export function formatCSTTime(date: string | Date): string {
  return formatInTimeZone(date, TZ_CST, "HH:mm", { locale: es });
}

/**
 * Format a UTC date to a relative "human" format in CST
 * e.g. "4 de marzo de 2026, 15:30"
 */
export function formatCSTHuman(date: string | Date): string {
  return formatInTimeZone(date, TZ_CST, "d 'de' MMMM 'de' yyyy, HH:mm", {
    locale: es,
  });
}

/**
 * Get a zoned Date object in CST (for client-side date pickers, etc.)
 */
export function toCST(date: string | Date): Date {
  return toZonedTime(date, TZ_CST);
}

/**
 * Calculate age from a birth date
 */
export function calculateAge(birthDate: string | Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
