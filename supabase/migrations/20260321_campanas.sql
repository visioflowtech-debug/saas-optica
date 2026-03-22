-- ============================================================
-- MÓDULO CAMPAÑAS - Óptica Nueva Imagen
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- 1. Flag campanas_activas en sucursales
ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS campanas_activas boolean NOT NULL DEFAULT false;

-- 2. Tabla principal de campañas
CREATE TABLE IF NOT EXISTS campanas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sucursal_id   uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  descripcion   text,
  fecha_inicio  date,
  fecha_fin     date,
  activa        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campanas_tenant_idx     ON campanas(tenant_id);
CREATE INDEX IF NOT EXISTS campanas_sucursal_idx   ON campanas(sucursal_id);

-- 3. Vincular pacientes a campaña (opcional)
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS campana_id uuid REFERENCES campanas(id) ON DELETE SET NULL;

-- 4. Vincular exámenes a campaña (opcional)
ALTER TABLE examenes_clinicos
  ADD COLUMN IF NOT EXISTS campana_id uuid REFERENCES campanas(id) ON DELETE SET NULL;

-- 5. Vincular órdenes de venta a campaña (opcional)
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS campana_id uuid REFERENCES campanas(id) ON DELETE SET NULL;

-- 6. RLS para campanas
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campanas_tenant_isolation" ON campanas;
CREATE POLICY "campanas_tenant_isolation" ON campanas
  FOR ALL
  USING (tenant_id::uuid = get_my_tenant_id());
