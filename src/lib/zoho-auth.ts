/**
 * Zoho Books OAuth2 — token refresh automático.
 * El access_token dura 1 hora; el refresh_token no expira.
 * Requiere: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID, ZOHO_API_DOMAIN
 *
 * En producción (serverless), el token se persiste en Supabase para que
 * no se renueve en cada instancia fría y no se dispare el rate limit de Zoho.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// Cache en memoria para la instancia actual (evita llamadas a Supabase en hot paths)
let memCache: { value: string; expiresAt: number } | null = null;

// Previene refreshes concurrentes dentro de la misma instancia
let refreshInFlight: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed: ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token error: ${data.error ?? JSON.stringify(data)}`);

  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  // Guardar en memoria
  memCache = { value: data.access_token, expiresAt };

  // Guardar en Supabase para compartir entre instancias serverless
  try {
    const supabase = createAdminClient();
    await supabase
      .from("empresas")
      .update({ zoho_token_cache: { access_token: data.access_token, expires_at: expiresAt } })
      .not("id", "is", null); // actualiza todos los tenants (token global de la app)
  } catch {
    // No crítico — si falla, la próxima instancia hará refresh igual
  }

  return data.access_token;
}

export async function getZohoAccessToken(): Promise<string> {
  // 1. Usar cache en memoria si es válido (60s de margen)
  if (memCache && Date.now() < memCache.expiresAt - 60_000) {
    return memCache.value;
  }

  // 2. Intentar leer desde Supabase (compartido entre instancias)
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("empresas")
      .select("zoho_token_cache")
      .limit(1)
      .single();

    const cache = data?.zoho_token_cache as { access_token: string; expires_at: number } | null;
    if (cache?.access_token && Date.now() < cache.expires_at - 60_000) {
      // Actualizar cache en memoria también
      memCache = { value: cache.access_token, expiresAt: cache.expires_at };
      return cache.access_token;
    }
  } catch {
    // Si falla lectura de Supabase, continuar hacia refresh
  }

  // 3. Renovar token (con guard contra concurrencia en la misma instancia)
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export function zohoHeaders(token: string) {
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
}

export const ZOHO_BASE = `${process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.com"}/books/v3`;
export const ZOHO_ORG = process.env.ZOHO_ORG_ID!;
