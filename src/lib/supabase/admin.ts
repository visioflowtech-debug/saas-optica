import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service_role key.
 * Bypasa RLS — usar ÚNICAMENTE en Server Actions / Route Handlers.
 * NUNCA importar en client components ni exponer al navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurado");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
