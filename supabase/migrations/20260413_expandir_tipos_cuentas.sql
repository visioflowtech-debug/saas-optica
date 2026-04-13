-- ============================================================
-- Expandir tipos de cuentas para soportar CxP y otras
-- ============================================================

-- Modificar CHECK constraint para agregar tipos adicionales
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_tipo_check;
ALTER TABLE cuentas ADD CONSTRAINT cuentas_tipo_check
  CHECK (tipo IN ('efectivo', 'banco', 'otro', 'cxp', 'cxc'));

-- Comentario:
-- - 'efectivo': Caja de efectivo
-- - 'banco': Cuenta bancaria
-- - 'otro': Cuenta genérica personalizada
-- - 'cxp': Cuentas por Pagar (proveedores)
-- - 'cxc': Cuentas por Cobrar (clientes)

-- La restricción UNIQUE sigue siendo (tenant_id, sucursal_id, tipo)
-- Lo que permite múltiples cuentas si tienen tipo diferente
