-- ============================================================
-- RLS MULTISUCURSAL - Óptica Nueva Imagen  (versión definitiva)
-- Tablas confirmadas en producción: 2026-03-21
-- ============================================================

-- ── Funciones auxiliares ─────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id::uuid FROM usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid()
$$;

-- ── empresas ──────────────────────────────────────────────────
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_tenant_isolation" ON empresas;
CREATE POLICY "empresas_tenant_isolation" ON empresas
  FOR ALL USING (id = get_my_tenant_id());

-- ── sucursales ────────────────────────────────────────────────
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sucursales_tenant_isolation" ON sucursales;
CREATE POLICY "sucursales_tenant_isolation" ON sucursales
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── usuarios ──────────────────────────────────────────────────
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios_select_tenant" ON usuarios;
CREATE POLICY "usuarios_select_tenant" ON usuarios
  FOR SELECT USING (tenant_id = get_my_tenant_id());
DROP POLICY IF EXISTS "usuarios_update_self_or_admin" ON usuarios;
CREATE POLICY "usuarios_update_self_or_admin" ON usuarios
  FOR UPDATE USING (id = auth.uid() OR get_my_rol() = 'administrador');

-- ── pacientes ─────────────────────────────────────────────────
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pacientes_tenant_isolation" ON pacientes;
CREATE POLICY "pacientes_tenant_isolation" ON pacientes
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── examenes_clinicos ─────────────────────────────────────────
ALTER TABLE examenes_clinicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "examenes_tenant_isolation" ON examenes_clinicos;
CREATE POLICY "examenes_tenant_isolation" ON examenes_clinicos
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── productos (reemplaza inventario_aros / inventario_lentes) ─
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "productos_tenant_isolation" ON productos;
CREATE POLICY "productos_tenant_isolation" ON productos
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── ordenes ───────────────────────────────────────────────────
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ordenes_tenant_isolation" ON ordenes;
CREATE POLICY "ordenes_tenant_isolation" ON ordenes
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── orden_detalle (sin tenant_id, acceso via ordenes) ─────────
ALTER TABLE orden_detalle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orden_detalle_via_orden" ON orden_detalle;
CREATE POLICY "orden_detalle_via_orden" ON orden_detalle
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ordenes o
      WHERE o.id = orden_detalle.orden_id
        AND o.tenant_id = get_my_tenant_id()
    )
  );

-- ── orden_laboratorio_datos ───────────────────────────────────
ALTER TABLE orden_laboratorio_datos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orden_lab_tenant_isolation" ON orden_laboratorio_datos;
CREATE POLICY "orden_lab_tenant_isolation" ON orden_laboratorio_datos
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── pagos ─────────────────────────────────────────────────────
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagos_tenant_isolation" ON pagos;
CREATE POLICY "pagos_tenant_isolation" ON pagos
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── laboratorio_estados ───────────────────────────────────────
ALTER TABLE laboratorio_estados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "laboratorio_tenant_isolation" ON laboratorio_estados;
CREATE POLICY "laboratorio_tenant_isolation" ON laboratorio_estados
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── campanas ──────────────────────────────────────────────────
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campanas_tenant_isolation" ON campanas;
CREATE POLICY "campanas_tenant_isolation" ON campanas
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── webhook_events (solo lectura para el tenant) ──────────────
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events_tenant_select" ON webhook_events;
CREATE POLICY "webhook_events_tenant_select" ON webhook_events
  FOR SELECT USING (tenant_id = get_my_tenant_id());
