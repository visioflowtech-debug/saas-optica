-- ============================================================
-- RPC: Saldo de cuentas calculado live desde movimientos_cuenta
-- Evita desincronización del campo saldo_actual cacheado.
-- Regla: ingresos/transferencia_in/ajuste_inicial suman;
--        egresos/transferencia_out restan.
-- ============================================================

CREATE OR REPLACE FUNCTION get_saldo_cuentas_computed(
  p_tenant_id   uuid,
  p_sucursal_id uuid
) RETURNS TABLE (
  id             uuid,
  tipo           text,
  nombre         text,
  saldo_computed numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    c.tipo,
    c.nombre,
    COALESCE(
      SUM(CASE
        WHEN m.tipo IN ('ingreso', 'transferencia_in', 'ajuste_inicial') THEN  m.monto
        WHEN m.tipo IN ('egreso',  'transferencia_out')                  THEN -m.monto
        ELSE 0
      END),
      0
    ) AS saldo_computed
  FROM cuentas c
  LEFT JOIN movimientos_cuenta m ON m.cuenta_id = c.id
  WHERE c.tenant_id   = p_tenant_id
    AND c.sucursal_id = p_sucursal_id
  GROUP BY c.id, c.tipo, c.nombre;
$$;

REVOKE ALL ON FUNCTION get_saldo_cuentas_computed(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_saldo_cuentas_computed(uuid, uuid) TO authenticated;
