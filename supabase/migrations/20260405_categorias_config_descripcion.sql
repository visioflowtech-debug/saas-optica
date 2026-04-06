-- Feature: campo descripcion en categorias_config (para numero_junta de optometristas)
ALTER TABLE categorias_config
  ADD COLUMN IF NOT EXISTS descripcion text;
