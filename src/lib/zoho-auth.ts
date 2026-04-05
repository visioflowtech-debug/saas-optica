/**
 * Zoho Books OAuth2 — token refresh automático.
 * El access_token dura 1 hora; el refresh_token no expira.
 * Requiere: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID, ZOHO_API_DOMAIN
 */

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getZohoAccessToken(): Promise<string> {
  // Reutilizar si aún es válido (con 60s de margen)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

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

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.value;
}

export function zohoHeaders(token: string) {
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
}

export const ZOHO_BASE = `${process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.com"}/books/v3`;
export const ZOHO_ORG = process.env.ZOHO_ORG_ID!;
