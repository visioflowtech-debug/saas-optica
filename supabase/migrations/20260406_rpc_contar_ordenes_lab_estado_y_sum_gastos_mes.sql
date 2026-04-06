-- RPC: cuenta órdenes cuyo estado ACTUAL de laboratorio es el indicado.
-- Usa DISTINCT ON para quedarse solo con la última fila por orden.
-- Filtra por sucursal a través del JOIN con ordenes (lab_estados no tiene sucursal_id).
CREATE OR REPLACE FUNCTION contar_ordenes_lab_estado(
  p_tenant_id   uuid,
  p_sucursal_id uuid,
  p_estado      text
) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)
  FROM (
    SELECT DISTINCT ON (le.orden_id) le.orden_id, le.estado
    FROM laboratorio_estados le
    JOIN ordenes o ON o.id = le.orden_id
    WHERE le.tenant_id = p_tenant_id
      AND o.sucursal_id = p_sucursal_id
      AND o.estado != 'cancelada'
    ORDER BY le.orden_id, le.updated_at DESC
  ) sub
  WHERE sub.estado = p_estado::lab_estado;
$$;

-- RPC: suma total de gastos del mes para un tenant/sucursal desde una fecha.
CREATE OR REPLACE FUNCTION sum_gastos_mes(
  p_tenant_id   uuid,
  p_sucursal_id uuid,
  p_fecha_inicio text
) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(monto), 0)
  FROM gastos
  WHERE tenant_id   = p_tenant_id
    AND sucursal_id = p_sucursal_id
    AND fecha >= p_fecha_inicio::date;
$$;
