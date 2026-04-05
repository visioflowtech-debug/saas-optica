-- Cache del access token de Zoho Books (compartido entre instancias serverless)
-- Se guarda en empresas para no crear tabla extra
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS zoho_token_cache jsonb;
