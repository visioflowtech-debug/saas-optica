-- Feature: AV con corrección + PIO en examenes_clinicos
ALTER TABLE examenes_clinicos
  ADD COLUMN IF NOT EXISTS av_od_cc text,
  ADD COLUMN IF NOT EXISTS av_oi_cc text,
  ADD COLUMN IF NOT EXISTS pio_od numeric(5,1),
  ADD COLUMN IF NOT EXISTS pio_oi numeric(5,1);

-- Feature: examen_id FK en ordenes (vincula examen clínico → orden de venta)
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS examen_id uuid REFERENCES examenes_clinicos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_examen_id ON ordenes(examen_id);
