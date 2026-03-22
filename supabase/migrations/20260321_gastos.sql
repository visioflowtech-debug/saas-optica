-- ============================================================
-- MÓDULO GASTOS - Óptica Nueva Imagen
-- ============================================================

CREATE TABLE IF NOT EXISTS gastos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sucursal_id   uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  campana_id    uuid REFERENCES campanas(id) ON DELETE SET NULL,
  registrado_por uuid REFERENCES usuarios(id),
  concepto      text NOT NULL,
  categoria     text NOT NULL DEFAULT 'operativo',
  -- categorias: transporte, hospedaje, alimentacion, publicidad, operativo, otro
  monto         numeric(12,2) NOT NULL CHECK (monto > 0),
  fecha         date NOT NULL DEFAULT CURRENT_DATE,
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_tenant_idx    ON gastos(tenant_id);
CREATE INDEX IF NOT EXISTS gastos_sucursal_idx  ON gastos(sucursal_id);
CREATE INDEX IF NOT EXISTS gastos_campana_idx   ON gastos(campana_id);
CREATE INDEX IF NOT EXISTS gastos_fecha_idx     ON gastos(fecha);

-- RLS
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gastos_tenant_isolation" ON gastos;
CREATE POLICY "gastos_tenant_isolation" ON gastos
  FOR ALL USING (tenant_id = get_my_tenant_id());
