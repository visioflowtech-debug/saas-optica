-- ─────────────────────────────────────────────────────────────
-- TABLA: laboratorios (proveedores de laboratorio óptico)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS laboratorios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  nombre      text NOT NULL,
  contacto    text,
  telefono    text,
  email       text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laboratorios_tenant ON laboratorios(tenant_id);

-- Ejemplos iniciales — se insertan sólo si no existen (por nombre+tenant)
-- El tenant debe existir: ajusta el UUID o déjalo vacío y agrégalos desde config
-- INSERT INTO laboratorios (tenant_id, nombre) VALUES (..., 'Lomed') ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- COLUMNA: laboratorio_id en orden_laboratorio_datos
-- Vincula cada orden de trabajo con el proveedor de laboratorio
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orden_laboratorio_datos
  ADD COLUMN IF NOT EXISTS laboratorio_id uuid REFERENCES laboratorios(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- TABLA: categorias_config (categorías personalizadas por módulo)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_config (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  modulo      text NOT NULL,   -- 'gastos'
  valor       text NOT NULL,   -- clave interna (slug)
  label       text NOT NULL,   -- texto visible
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, modulo, valor)
);

CREATE INDEX IF NOT EXISTS idx_categorias_config_tenant_modulo ON categorias_config(tenant_id, modulo);

-- RLS: mismo patrón que el resto del sistema
ALTER TABLE laboratorios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_laboratorios"      ON laboratorios      FOR ALL USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_categorias_config" ON categorias_config FOR ALL USING (tenant_id = get_my_tenant_id());
