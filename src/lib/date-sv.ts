/**
 * Utilidades de fecha para zona horaria El Salvador (America/El_Salvador = UTC-6).
 * Supabase guarda todos los timestamps en UTC (timestamptz).
 * Estas funciones garantizan que la visualización siempre sea en hora SV,
 * independientemente del timezone del servidor o del navegador del usuario.
 */

const TZ = "America/El_Salvador";

/**
 * Formatea un timestamp UTC (ISO string de Supabase) a fecha en hora SV.
 * Uso: fmtFecha(orden.created_at) → "21 mar 2026"
 */
export function fmtFecha(isoString: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(isoString).toLocaleDateString("es-SV", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

/**
 * Formatea un timestamp UTC a fecha corta en hora SV.
 * Uso: fmtFechaCorta(orden.created_at) → "21 mar"
 */
export function fmtFechaCorta(isoString: string): string {
  return new Date(isoString).toLocaleDateString("es-SV", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  });
}

/**
 * Formatea una columna DATE de Postgres (string "YYYY-MM-DD", sin tiempo).
 * Se interpola con T12:00:00Z (mediodía UTC) para evitar problemas de offset.
 * Uso: fmtDate(gasto.fecha) → "21 mar 2026"
 */
export function fmtDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("es-SV", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

/**
 * Retorna la fecha actual en hora SV como string para mostrar.
 * Uso: fmtHoy() → "21 mar 2026"
 */
export function fmtHoy(): string {
  return new Date().toLocaleDateString("es-SV", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Convierte una fecha "YYYY-MM-DD" seleccionada en SV al inicio del día en UTC.
 * Inicio del día SV (00:00 SV) = 06:00 UTC.
 * Uso: para filtros .gte("created_at", svFechaInicioUTC(fechaDesde))
 */
export function svFechaInicioUTC(dateStr: string): string {
  return dateStr + "T06:00:00.000Z";
}

/**
 * Convierte una fecha "YYYY-MM-DD" seleccionada en SV al fin del día en UTC.
 * Fin del día SV (23:59:59 SV) = 05:59:59 UTC del día siguiente.
 * Uso: para filtros .lte("created_at", svFechaFinUTC(fechaHasta))
 */
export function svFechaFinUTC(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split("T")[0];
  return nextDay + "T05:59:59.999Z";
}
