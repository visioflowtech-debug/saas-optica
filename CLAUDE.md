# SaaS Óptica — Contexto del Proyecto

## Stack tecnológico
- **Framework**: Next.js 16 App Router (Server Components por defecto)
- **DB / Auth / Storage**: Supabase (PostgreSQL + RLS + Auth)
- **UI**: Tailwind CSS v4 + Lucide React
- **PDF**: jsPDF + jspdf-autotable
- **Drag & drop**: @dnd-kit (kanban laboratorio)
- **IA clínica**: @google/generative-ai → `gemini-2.0-flash` (llamadas siempre server-side)
- **Deploy**: Vercel (branch `main` → producción automática)
- **Timezone**: El Salvador UTC-6, sin horario de verano

## Arquitectura multi-tenant
- Toda tabla lleva `tenant_id` (empresa) y la mayoría `sucursal_id`
- **NUNCA** hacer queries sin filtrar por `tenant_id` y `sucursal_id` del contexto
- RLS en Supabase hace segunda línea de defensa, pero validar siempre en Server Actions
- Contexto obtenido en layout desde `usuarios` JOIN `sucursales` JOIN `empresas`

## Patrones clave

### Server Actions (`"use server"`)
```ts
// SIEMPRE obtener contexto al inicio
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const { data: perfil } = await supabase.from("usuarios")
  .select("tenant_id, sucursal_id, rol")
  .eq("id", user.id).single()
```
- Solo exportar funciones async (no objetos, no constantes)
- Llamar `revalidatePath("/dashboard/...")` al final de mutaciones
- Cuando la action es llamada desde un Client Component (no form), retornar `{ data }` o `{ error: string }` en vez de `redirect()` — el cliente maneja el estado localmente con `useState` + `useTransition`

### Componentes cliente (`"use client"`)
- Solo cuando necesitas: estado, eventos, hooks, dnd-kit, jsPDF
- Pasar Server Actions como props a Client Components (bind pattern)
- Nunca importar `createClient` de `server.ts` en client components

### Timezone (CRÍTICO)
```ts
import { fmtFecha, fmtFechaCorta, svFechaInicioUTC, svFechaFinUTC } from "@/lib/date-sv"
// Display largo:  fmtFecha(row.created_at)      → "21 mar 2026"
// Display corto:  fmtFechaCorta(row.created_at) → "21/03/26" (tarjetas, tablas)
// Filtros DB: gte("created_at", svFechaInicioUTC("2026-03-21"))
//             lte("created_at", svFechaFinUTC("2026-03-21"))
// NO usar T00:00:00 sin Z — Postgres interpreta en UTC
```

## Tablas de base de datos
| Tabla | Propósito |
|---|---|
| `empresas` | Tenant raíz (nombre, nit, logo_url) |
| `sucursales` | Branches (`campanas_activas` flag) |
| `usuarios` | Perfiles ligados a auth.users (rol, sucursal_id) |
| `pacientes` | Patients con etiquetas_medicas[] |
| `examenes_clinicos` | Refracciones RA/RF OD/OI, AV, PIO, informe_ia (Gemini) |
| `ordenes` | Ventas/proformas (estado: borrador→confirmada→facturada) |
| `orden_detalle` | Líneas de orden (producto_id, cantidad, precio) |
| `orden_laboratorio_datos` | JSON de lentes + laboratorio_id FK |
| `laboratorio_estados` | Historial de estados kanban (pendiente→entregado) |
| `laboratorios` | Proveedores de lab (tenant-scoped) |
| `productos` | Inventario (tipo: aro/lente/tratamiento) |
| `categorias_config` | Categorías configurables por módulo. Esquema: `modulo` (ej. "optometristas"), `label` (nombre visible), `descripcion` (valor extra, ej. número de junta) |
| `pagos` | Abonos por orden (metodo_pago, referencia) |
| `gastos` | Egresos de campaña/sucursal |
| `campanas` | Campañas de ventas (flag `activa`) |
| `webhook_events` | Log de eventos externos |

## Roles de usuario
`administrador` | `optometrista` | `asesor_visual` | `laboratorio`

## Estados de flujo
- **Orden**: `borrador → confirmada → facturada | cancelada`
- **Lab**: `pendiente → en_laboratorio → recibido → entregado`

## Estructura de archivos
```
src/app/(dashboard)/dashboard/[modulo]/
  page.tsx          ← Server Component, fetch + render
  actions.ts        ← "use server" — todas las mutaciones del módulo
  [componente].tsx  ← Client Components para interactividad
src/lib/
  date-sv.ts        ← timezone helpers (USAR SIEMPRE para fechas)
  constants.ts      ← enums y listas (no duplicar aquí)
  utils.ts          ← cn(), formatCurrency()
src/components/     ← Componentes reutilizables cross-módulo
```

## Convenciones de código
- Español para nombres de funciones, variables y comentarios de negocio
- Inglés para tipos TypeScript genéricos
- Prefijo `obtener*` para queries, `crear*`/`actualizar*`/`eliminar*` para mutaciones
- Formularios con `FormData` nativo (no react-hook-form)
- `revalidatePath` después de cada mutación exitosa

## Agentes disponibles (sub-agentes especializados)
Usa el Agent tool con estos sub-agentes según el tipo de tarea:
- **`backend`** — Server Actions, queries Supabase, lógica de negocio
- **`frontend`** — UI components, Tailwind, UX, mobile
- **`qa`** — Revisión de bugs, edge cases, validaciones
- **`security`** — RLS, auth, inyecciones, performance
- **`optometria`** — Sugerencias de features del dominio óptica/optometría
- **`ux-optimizer`** — Responsive design, Web Vitals, accesibilidad, compatibilidad iOS/Android/Windows, performance a escala
- **`api-architect`** — API-first: endpoints REST, webhooks salientes/entrantes, integraciones (Make, n8n, GHL, WhatsApp, Meta)

## Skills disponibles (slash commands)
- `/nueva-feature [descripción]` — Planifica e implementa nueva funcionalidad
- `/qa-check [módulo]` — Revisión QA del módulo o cambios recientes
- `/security-audit [módulo]` — Auditoría de seguridad y tenant isolation
- `/optimize-ux [módulo]` — Responsive, performance a escala, índices DB, paginación, búsquedas eficientes
- `/api-design [endpoint|integración]` — Diseña/implementa endpoints REST, webhooks, integraciones externas
- `/deploy` — Versionar y desplegar a producción
- `/sugerir-features` — Experto en optometría sugiere próximas features

## Variables de entorno requeridas
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=          # Solo server-side — nunca NEXT_PUBLIC_
```

## No hacer (errores comunes)
- No pasar arrow functions como props a Server Components (`() => fn(id)` → usar `.bind(null, id)`)
- No olvidar `tenant_id` en INSERT — causa leak entre tenants
- No usar `new Date()` del cliente para timestamps — dejar que Postgres use `now()`
- No importar `server.ts` de Supabase en client components
- No crear helpers/abstracciones para operaciones de un solo uso

## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.
