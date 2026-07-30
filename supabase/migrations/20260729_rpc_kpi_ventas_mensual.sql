-- RPC: ventas mensuales (últimos p_meses meses, incluyendo el actual) con el
-- desglose pagado vs pendiente por mes, en hora El Salvador. Usado por el
-- gráfico de barras apiladas de la página de Ventas.
-- Mismo criterio de "venta real" que v_cuentas_cobrar / ids_ordenes_saldo_pendiente:
-- estado IN ('confirmada', 'facturada').
CREATE OR REPLACE FUNCTION public.kpi_ventas_mensual(
  p_tenant_id uuid,
  p_sucursal_id uuid,
  p_meses integer DEFAULT 6
)
RETURNS TABLE(mes date, total_ventas numeric, total_pagado numeric, total_pendiente numeric)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', (now() AT TIME ZONE 'America/El_Salvador'))::date - ((p_meses - 1) || ' months')::interval,
      date_trunc('month', (now() AT TIME ZONE 'America/El_Salvador'))::date,
      '1 month'::interval
    )::date AS mes
  ),
  agregado AS (
    SELECT
      date_trunc('month', (o.created_at AT TIME ZONE 'America/El_Salvador'))::date AS mes,
      SUM(o.total) AS total_ventas,
      SUM(LEAST(o.total, COALESCE(p.pagado, 0))) AS total_pagado,
      SUM(GREATEST(o.total - COALESCE(p.pagado, 0), 0)) AS total_pendiente
    FROM ordenes o
    LEFT JOIN (
      SELECT orden_id, SUM(monto) AS pagado FROM pagos GROUP BY orden_id
    ) p ON p.orden_id = o.id
    WHERE o.tenant_id = p_tenant_id
      AND o.sucursal_id = p_sucursal_id
      AND o.estado IN ('confirmada', 'facturada')
    GROUP BY 1
  )
  SELECT
    m.mes,
    COALESCE(a.total_ventas, 0)    AS total_ventas,
    COALESCE(a.total_pagado, 0)    AS total_pagado,
    COALESCE(a.total_pendiente, 0) AS total_pendiente
  FROM meses m
  LEFT JOIN agregado a ON a.mes = m.mes
  ORDER BY m.mes
$$;
