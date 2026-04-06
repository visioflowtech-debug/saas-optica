-- ============================================================
-- MÓDULO CUENTAS — Óptica Nueva Imagen
-- Tablas: cuentas, movimientos_cuenta, transferencias_cuenta
-- Vista: v_cuentas_cobrar
-- ============================================================

-- ── Tabla cuentas ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  sucursal_id   uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('efectivo', 'banco')),
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
  saldo_actual  numeric(14,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sucursal_id, tipo)
);

CREATE INDEX IF NOT EXISTS cuentas_tenant_idx    ON cuentas(tenant_id);
CREATE INDEX IF NOT EXISTS cuentas_sucursal_idx  ON cuentas(sucursal_id);

ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cuentas_tenant_isolation" ON cuentas;
CREATE POLICY "cuentas_tenant_isolation" ON cuentas
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── Tabla movimientos_cuenta ────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_cuenta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id       uuid NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'ajuste_inicial', 'transferencia_in', 'transferencia_out')),
  monto           numeric(14,2) NOT NULL CHECK (monto > 0),
  descripcion     text,
  referencia_tipo text CHECK (referencia_tipo IN ('pago', 'gasto', 'transferencia', 'ajuste')),
  referencia_id   uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movimientos_cuenta_cuenta_idx  ON movimientos_cuenta(cuenta_id);
CREATE INDEX IF NOT EXISTS movimientos_cuenta_tenant_idx  ON movimientos_cuenta(tenant_id);
CREATE INDEX IF NOT EXISTS movimientos_cuenta_created_idx ON movimientos_cuenta(created_at DESC);

ALTER TABLE movimientos_cuenta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movimientos_cuenta_tenant_isolation" ON movimientos_cuenta;
CREATE POLICY "movimientos_cuenta_tenant_isolation" ON movimientos_cuenta
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── Trigger: actualizar saldo en cuentas ───────────────────
CREATE OR REPLACE FUNCTION trg_actualizar_saldo_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo IN ('ingreso', 'transferencia_in', 'ajuste_inicial') THEN
    UPDATE cuentas SET saldo_actual = saldo_actual + NEW.monto, updated_at = now()
    WHERE id = NEW.cuenta_id;
  ELSIF NEW.tipo IN ('egreso', 'transferencia_out') THEN
    UPDATE cuentas SET saldo_actual = saldo_actual - NEW.monto, updated_at = now()
    WHERE id = NEW.cuenta_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_saldo ON movimientos_cuenta;
CREATE TRIGGER trg_actualizar_saldo
  AFTER INSERT ON movimientos_cuenta
  FOR EACH ROW EXECUTE FUNCTION trg_actualizar_saldo_fn();

-- ── Tabla transferencias_cuenta ─────────────────────────────
CREATE TABLE IF NOT EXISTS transferencias_cuenta (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cuenta_origen_id  uuid NOT NULL REFERENCES cuentas(id),
  cuenta_destino_id uuid NOT NULL REFERENCES cuentas(id),
  monto             numeric(14,2) NOT NULL CHECK (monto > 0),
  descripcion       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transferencias_tenant_idx ON transferencias_cuenta(tenant_id);

ALTER TABLE transferencias_cuenta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transferencias_cuenta_tenant_isolation" ON transferencias_cuenta;
CREATE POLICY "transferencias_cuenta_tenant_isolation" ON transferencias_cuenta
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── Columna pagado_con en gastos ───────────────────────────
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS pagado_con text NOT NULL DEFAULT 'efectivo'
  CHECK (pagado_con IN ('efectivo', 'banco'));

-- ── Vista v_cuentas_cobrar ──────────────────────────────────
-- Retorna UNA fila por (tenant_id, sucursal_id) con el total pendiente de cobro
CREATE OR REPLACE VIEW v_cuentas_cobrar AS
SELECT
  o.tenant_id,
  o.sucursal_id,
  COALESCE(SUM(o.total), 0) - COALESCE(SUM(p.pagado), 0) AS saldo_pendiente
FROM ordenes o
LEFT JOIN (
  SELECT orden_id, SUM(monto) AS pagado
  FROM pagos
  GROUP BY orden_id
) p ON p.orden_id = o.id
WHERE o.estado IN ('confirmada', 'facturada')
GROUP BY o.tenant_id, o.sucursal_id;
