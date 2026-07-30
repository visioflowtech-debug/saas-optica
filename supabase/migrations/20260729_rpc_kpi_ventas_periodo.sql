-- RPC: monto de ventas facturadas de hoy y del mes en curso (hora El Salvador).
-- Usado en el dashboard de inicio y en la página de Ventas para las tarjetas
-- "Ventas Hoy" y "Ventas Mes". Los límites de fecha se calculan en la app
-- (svFechaInicioUTC) y se pasan ya convertidos a UTC.
CREATE OR REPLACE FUNCTION public.kpi_ventas_periodo(
  p_tenant_id uuid,
  p_sucursal_id uuid,
  p_inicio_hoy timestamptz,
  p_inicio_mes timestamptz
)
RETURNS TABLE(ventas_hoy numeric, ventas_mes numeric)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT
    COALESCE(SUM(total) FILTER (WHERE estado = 'facturada' AND created_at >= p_inicio_hoy), 0) AS ventas_hoy,
    COALESCE(SUM(total) FILTER (WHERE estado = 'facturada' AND created_at >= p_inicio_mes), 0) AS ventas_mes
  FROM ordenes
  WHERE tenant_id = p_tenant_id
    AND sucursal_id = p_sucursal_id
    AND created_at >= p_inicio_mes
$$;
