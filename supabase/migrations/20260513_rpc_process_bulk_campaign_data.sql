-- RPC atómica para carga masiva de campaña
-- Inserta en una sola transacción: paciente → examen_clinico → orden → orden_detalle → pago
-- Si cualquier fila falla, se hace ROLLBACK de todo el batch.

CREATE OR REPLACE FUNCTION process_bulk_campaign_data(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campana_id    UUID;
  v_tenant_id     UUID;
  v_sucursal_id   UUID;
  v_asesor_id     UUID;
  fila            JSONB;
  v_paciente_id   UUID;
  v_examen_id     UUID;
  v_orden_id      UUID;
  v_producto_id   UUID;
  v_tipo_producto TEXT;
  v_cantidad      INTEGER;
  v_monto         NUMERIC;
  v_precio_unit   NUMERIC;
  v_caller_tid    UUID;
  fila_idx        INTEGER := 0;
  resultados      JSONB   := '[]'::JSONB;
BEGIN
  v_campana_id  := (payload->>'campana_id')::UUID;
  v_tenant_id   := (payload->>'tenant_id')::UUID;
  v_sucursal_id := (payload->>'sucursal_id')::UUID;
  v_asesor_id   := (payload->>'asesor_id')::UUID;

  -- Verificar que el usuario autenticado pertenece al tenant declarado
  SELECT tenant_id INTO v_caller_tid
  FROM usuarios
  WHERE id = auth.uid();

  IF v_caller_tid IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'No autorizado: tenant_id no coincide con el usuario autenticado';
  END IF;

  -- Verificar que la campaña pertenece al tenant y sucursal correctos
  IF NOT EXISTS (
    SELECT 1 FROM campanas
    WHERE id         = v_campana_id
      AND tenant_id  = v_tenant_id
      AND sucursal_id = v_sucursal_id
  ) THEN
    RAISE EXCEPTION 'Campaña no encontrada o no autorizada para este tenant/sucursal';
  END IF;

  FOR fila IN SELECT value FROM jsonb_array_elements(payload->'filas')
  LOOP
    fila_idx := fila_idx + 1;

    -- 1. Insertar paciente
    INSERT INTO pacientes (
      tenant_id, sucursal_id, campana_id,
      nombre, telefono
    )
    VALUES (
      v_tenant_id,
      v_sucursal_id,
      v_campana_id,
      fila->>'paciente_nombre',
      NULLIF(trim(fila->>'paciente_telefono'), '')
    )
    RETURNING id INTO v_paciente_id;

    -- 2. Insertar examen clínico (solo campos RF del CSV)
    INSERT INTO examenes_clinicos (
      tenant_id, sucursal_id, paciente_id, campana_id,
      rf_od_esfera,   rf_od_cilindro,   rf_od_eje,   rf_od_adicion,
      rf_oi_esfera,   rf_oi_cilindro,   rf_oi_eje,   rf_oi_adicion,
      observaciones
    )
    VALUES (
      v_tenant_id, v_sucursal_id, v_paciente_id, v_campana_id,
      CASE WHEN trim(fila->>'rf_od_esfera') ~ '^[+-]?[0-9]+\.?[0-9]*$'
           THEN trim(fila->>'rf_od_esfera')::NUMERIC ELSE NULL END,
      NULLIF(fila->>'rf_od_cilindro',  '')::NUMERIC,
      NULLIF(fila->>'rf_od_eje',       '')::INTEGER,
      NULLIF(fila->>'rf_od_adicion',   '')::NUMERIC,
      CASE WHEN trim(fila->>'rf_oi_esfera') ~ '^[+-]?[0-9]+\.?[0-9]*$'
           THEN trim(fila->>'rf_oi_esfera')::NUMERIC ELSE NULL END,
      NULLIF(fila->>'rf_oi_cilindro',  '')::NUMERIC,
      NULLIF(fila->>'rf_oi_eje',       '')::INTEGER,
      NULLIF(fila->>'rf_oi_adicion',   '')::NUMERIC,
      NULLIF(trim(fila->>'examen_observaciones'), '')
    )
    RETURNING id INTO v_examen_id;

    -- 3. Extraer producto directamente del CSV (el cliente ya validó UUID y tipo)
    v_producto_id   := (fila->>'producto_id')::UUID;
    v_tipo_producto := fila->>'tipo_producto';

    -- 4. Calcular montos (cantidad = 1 por fila de CSV)
    v_monto       := (fila->>'monto_pagado')::NUMERIC;
    v_cantidad    := 1;
    v_precio_unit := v_monto;

    -- 5. Insertar orden (confirmada desde bulk)
    INSERT INTO ordenes (
      tenant_id, sucursal_id, paciente_id, examen_id, campana_id, asesor_id,
      idempotency_key, tipo, estado,
      subtotal, descuento, total
    )
    VALUES (
      v_tenant_id, v_sucursal_id, v_paciente_id, v_examen_id, v_campana_id, v_asesor_id,
      gen_random_uuid()::TEXT,
      'orden_trabajo',
      'confirmada',
      v_monto, 0, v_monto
    )
    RETURNING id INTO v_orden_id;

    -- 6. Insertar línea de detalle
    INSERT INTO orden_detalle (
      orden_id, tenant_id,
      producto_id, tipo_producto, descripcion,
      cantidad, precio_unitario, subtotal
    )
    VALUES (
      v_orden_id, v_tenant_id,
      v_producto_id,
      v_tipo_producto,
      NULLIF(trim(fila->>'producto_descripcion'), ''),
      v_cantidad,
      v_precio_unit,
      v_monto
    );

    -- 7. Registrar pago
    INSERT INTO pagos (
      orden_id, tenant_id,
      monto, metodo_pago
    )
    VALUES (
      v_orden_id, v_tenant_id,
      v_monto,
      'efectivo'
    );

    resultados := resultados || jsonb_build_array(
      jsonb_build_object(
        'fila',        fila_idx,
        'paciente_id', v_paciente_id,
        'examen_id',   v_examen_id,
        'orden_id',    v_orden_id
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok',         true,
    'insertados', fila_idx,
    'resultados', resultados
  );
END;
$$;

-- Solo los usuarios autenticados pueden llamar esta función
REVOKE ALL ON FUNCTION process_bulk_campaign_data(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_bulk_campaign_data(JSONB) TO authenticated;
