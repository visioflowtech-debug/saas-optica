-- Campo DP único en examen clínico (texto libre: "60" ó "60/65")
ALTER TABLE examenes_clinicos ADD COLUMN IF NOT EXISTS dp_unico text;
