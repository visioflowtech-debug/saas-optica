-- Agrega campos de informe clínico IA al historial de exámenes.
-- informe_ia: texto generado por Gemini con análisis clínico.
-- informe_ia_generado_at: timestamp de la última generación.
ALTER TABLE examenes_clinicos
  ADD COLUMN IF NOT EXISTS informe_ia TEXT,
  ADD COLUMN IF NOT EXISTS informe_ia_generado_at TIMESTAMPTZ;
