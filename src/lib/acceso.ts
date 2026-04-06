/**
 * Control de acceso por rol.
 * Define qué módulos puede ver/acceder cada rol.
 * Usado en Server Components para redirigir si el rol no tiene acceso.
 */

const MODULOS_POR_ROL: Record<string, string[]> = {
  administrador: ["inicio", "campanas", "pacientes", "examenes", "ventas", "laboratorio", "inventario", "gastos", "cuentas", "configuracion"],
  optometrista:  ["inicio", "campanas", "pacientes", "examenes", "laboratorio"],
  asesor_visual: ["inicio", "campanas", "pacientes", "ventas", "inventario", "gastos"],
  laboratorio:   ["inicio", "laboratorio"],
  contador:      ["inicio", "campanas", "ventas", "inventario", "gastos"],
};

/**
 * Devuelve true si el rol tiene acceso al módulo dado.
 * Fallback a asesor_visual si el rol no está en el mapa.
 */
export function puedeAcceder(rol: string, modulo: string): boolean {
  const modulos = MODULOS_POR_ROL[rol] ?? MODULOS_POR_ROL.asesor_visual;
  return modulos.includes(modulo);
}
