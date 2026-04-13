-- ============================================================
-- Permitir múltiples cuentas del mismo tipo por sucursal
-- Eliminar constraint UNIQUE (tenant_id, sucursal_id, tipo)
-- ============================================================

-- Eliminar el constraint UNIQUE que limitaba a 1 cuenta por tipo
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_tenant_id_sucursal_id_tipo_key;

-- Ya no hay limitación: puedes crear:
-- - Múltiples cuentas de tipo "efectivo" (Caja 1, Caja 2, etc.)
-- - Múltiples cuentas de tipo "banco" (Banco A, Banco B, etc.)
-- - Múltiples cuentas de tipo "cxp" (Viviana, Gerson, etc.)
-- - Múltiples cuentas de tipo "cxc" (Cliente A, Cliente B, etc.)
-- - Múltiples cuentas de tipo "otro" (Custom 1, Custom 2, etc.)

-- El único control es a nivel de aplicación: nombres únicos por sucursal si se requiere
