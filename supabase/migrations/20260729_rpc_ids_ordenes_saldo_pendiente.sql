-- RPC: ids de órdenes con saldo pendiente de cobro (confirmada/facturada,
-- total - pagado > 0.01). Usado por el filtro "Saldo Pendiente" en Ventas.
-- Mismo criterio de estados que la vista v_cuentas_cobrar.
CREATE OR REPLACE FUNCTION public.ids_ordenes_saldo_pendiente(
  p_tenant_id uuid,
  p_sucursal_id uuid
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT o.id
  FROM ordenes o
  LEFT JOIN (
    SELECT orden_id, SUM(monto) AS pagado FROM pagos GROUP BY orden_id
  ) p ON p.orden_id = o.id
  WHERE o.tenant_id = p_tenant_id
    AND o.sucursal_id = p_sucursal_id
    AND o.estado IN ('confirmada', 'facturada')
    AND o.total - COALESCE(p.pagado, 0) > 0.01
$$;
