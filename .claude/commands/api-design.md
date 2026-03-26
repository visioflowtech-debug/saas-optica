Diseña, audita o implementa la capa de API pública e integraciones del sistema SaaS Óptica.

**Alcance o tarea específica**: $ARGUMENTS (si vacío, auditar toda la capa de API)

Actúa como arquitecto de APIs REST y experto en integraciones con automatización (Make.com, n8n,
Go High Level, WhatsApp Business API, Meta Lead Ads). El sistema debe ser API-first: cada feature
construida internamente debe poder ser consumida por sistemas externos mediante endpoints y webhooks.

**Contexto del sistema:**
- Stack: Next.js 16 App Router — los endpoints van en `src/app/api/v1/`
- Tabla `webhook_events` ya existe para logging de eventos entrantes/salientes
- Tabla `api_keys` pendiente de crear para autenticación de integraciones
- Arquitectura multi-tenant: toda respuesta de API debe estar scoped a `tenant_id`
- El módulo de leads (`/api/v1/leads`) es el primer endpoint prioritario

---

## 1. AUDITORÍA DE ENDPOINTS EXISTENTES

Revisar todos los archivos en `src/app/api/`:
- [ ] ¿Cada endpoint verifica autenticación (API key o JWT)?
- [ ] ¿Las respuestas están scoped a `tenant_id` (nunca datos de otros tenants)?
- [ ] ¿Se validan y sanitizan todos los campos del body antes de insertar?
- [ ] ¿Los errores retornan códigos HTTP correctos (400, 401, 403, 404, 422, 500)?
- [ ] ¿Los errores no exponen detalles internos de DB (mensajes de Postgres)?
- [ ] ¿Los endpoints idempotentes manejan duplicados correctamente?
- [ ] ¿Hay rate limiting configurado?

---

## 2. DISEÑO DE NUEVOS ENDPOINTS

Para cada endpoint nuevo, seguir esta estructura:

### Convención de rutas
```
GET    /api/v1/[recurso]           → listar (paginado)
POST   /api/v1/[recurso]           → crear
GET    /api/v1/[recurso]/[id]      → detalle
PATCH  /api/v1/[recurso]/[id]      → actualizar parcial
DELETE /api/v1/[recurso]/[id]      → eliminar

Webhooks entrantes:
POST   /api/webhooks/[fuente]      → meta, whatsapp, ghl, automatizacion
```

### Template de endpoint Next.js API Route
```ts
// src/app/api/v1/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Autenticación por API key
async function autenticarApiKey(request: NextRequest) {
  const key = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!key) return null;
  // Buscar en api_keys table, verificar hash, retornar tenant_id
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_keys")
    .select("tenant_id, permisos")
    .eq("key_hash", hashKey(key))  // nunca guardar key en plano
    .eq("activa", true)
    .single();
  return data;
}

export async function POST(request: NextRequest) {
  const auth = await autenticarApiKey(request);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  // Validar campos requeridos
  if (!body.nombre || !body.telefono) {
    return NextResponse.json({ error: "nombre y telefono son requeridos" }, { status: 422 });
  }
  // Insertar scoped al tenant de la API key
  // ...
  return NextResponse.json({ id: "...", success: true }, { status: 201 });
}
```

### Campos de respuesta estándar
```ts
// Éxito
{ data: {...}, meta: { page, total, per_page } }

// Error
{ error: "Descripción del error", code: "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" }

// Webhook recibido
{ received: true, event_id: "..." }
```

---

## 3. SISTEMA DE WEBHOOKS SALIENTES

El sistema debe emitir eventos a URLs configuradas por el cliente (Make.com, n8n, GHL).

### Eventos prioritarios a implementar
```ts
type WebhookEventType =
  | "lead.creado"          // lead entra al sistema
  | "lead.convertido"      // lead → paciente
  | "cita.agendada"        // nueva cita programada
  | "cita.recordatorio"    // 24h antes de la cita
  | "cita.completada"      // paciente atendido
  | "cita.no_asistio"      // no-show
  | "orden.confirmada"     // venta confirmada
  | "orden.lista_retiro"   // lentes llegaron del lab
  | "campana.iniciada"     // campaña activa
```

### Dispatcher de webhooks
```ts
// src/lib/webhook-dispatcher.ts
export async function emitirEvento(
  tenantId: string,
  evento: WebhookEventType,
  payload: Record<string, unknown>
) {
  // 1. Buscar suscripciones activas para este tenant + evento
  // 2. Para cada suscripción, hacer POST con retry (max 3 intentos)
  // 3. Registrar resultado en webhook_events
  // 4. Firmar payload con HMAC-SHA256 para que el destino pueda verificar
}
```

### Firma de webhooks (seguridad)
```ts
// Header en cada webhook saliente:
"X-Optica-Signature": hmac_sha256(secret, JSON.stringify(payload))
// El receptor verifica la firma para autenticar que viene del sistema
```

---

## 4. WEBHOOKS ENTRANTES

### Meta Lead Ads
```
POST /api/webhooks/meta
Verifica: X-Hub-Signature-256 header con el secret de Meta
Acción: crear lead en tabla leads con fuente="meta_ads", datos en datos_externos JSONB
```

### WhatsApp Business
```
POST /api/webhooks/whatsapp
Verifica: token de verificación de Meta
Acción: registrar mensaje, crear lead si es nuevo número, actualizar estado
```

### Make.com / n8n / Zapier
```
POST /api/webhooks/automatizacion
Auth: Bearer token de API key del tenant
Acción: ejecutar acción indicada en body (crear cita, actualizar lead, etc.)
```

---

## 5. AUTENTICACIÓN Y SEGURIDAD DE API

### Tabla api_keys (crear si no existe)
```sql
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES empresas(id),
  nombre      TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,  -- SHA-256 del key, nunca el key en plano
  prefijo     TEXT NOT NULL,         -- primeros 8 chars para identificar ("sk_live_abc12345...")
  permisos    TEXT[] DEFAULT ARRAY['leads:write','citas:read'],
  activa      BOOLEAN DEFAULT true,
  ultimo_uso  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Formato de API keys
```
sk_live_[32 chars random]    ← producción
sk_test_[32 chars random]    ← testing/desarrollo
```

### Rate limiting
- 60 requests/minuto por API key (usar Vercel Edge Middleware o upstash/ratelimit)
- 10 requests/minuto para endpoints de creación (POST)
- Retornar 429 con header `Retry-After` cuando se supera el límite

---

## 6. DOCUMENTACIÓN OPENAPI

Generar o actualizar `src/app/api/openapi.json`:
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "SaaS Óptica API",
    "version": "1.0.0",
    "description": "API pública para integraciones con sistemas externos"
  },
  "servers": [{ "url": "https://[dominio]/api/v1" }],
  "security": [{ "BearerAuth": [] }],
  "components": {
    "securitySchemes": {
      "BearerAuth": { "type": "http", "scheme": "bearer" }
    }
  },
  "paths": { ... }
}
```

---

## 7. INTEGRACIÓN CON SISTEMAS EXTERNOS

Para cada integración solicitada, documentar:

### Go High Level (GHL)
- Webhook entrante: GHL → sistema cuando hay nuevo lead en pipeline
- Webhook saliente: sistema → GHL cuando lead se convierte a paciente
- Campo de mapeo: `ghl_contact_id` en tabla leads

### Make.com / n8n
- Trigger: webhook saliente del sistema → Make scenario
- Action: Make llama `/api/v1/leads` o `/api/v1/citas` via HTTP module
- Auth: API key en header Authorization

### Meta Lead Ads
- Setup: webhook verificado con token en Meta Business Suite
- Flow: nuevo lead en Meta → POST /api/webhooks/meta → lead creado con campana_id

### WhatsApp Business (360dialog o Meta directamente)
- Mensajes entrantes → registrar en leads o actualizar estado
- Mensajes salientes → enviar recordatorios de cita (template aprobado)

---

## OUTPUT ESPERADO

### 🏗️ Arquitectura recomendada
Diagrama en texto del flujo de datos entre sistemas.

### 📋 Endpoints a crear (priorizado)
Lista ordenada con: método, ruta, propósito, campos requeridos, autenticación.

### 🔌 Webhooks a implementar
Lista de eventos con payload de ejemplo para cada uno.

### ⚠️ Riesgos y consideraciones
Seguridad, rate limits, idempotencia, manejo de errores.

### 💻 Código
Implementar los endpoints y webhooks indicados en $ARGUMENTS, o el endpoint de leads si no se especifica.
Al terminar, ejecutar `/deploy` para publicar los cambios.
