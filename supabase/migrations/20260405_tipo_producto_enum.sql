-- Ampliar ENUM tipo_producto para soportar servicios, accesorios y otros
ALTER TYPE tipo_producto ADD VALUE IF NOT EXISTS 'servicio';
ALTER TYPE tipo_producto ADD VALUE IF NOT EXISTS 'accesorio';
ALTER TYPE tipo_producto ADD VALUE IF NOT EXISTS 'otro';
