Planifica la implementación de esta nueva funcionalidad para el sistema SaaS de óptica:

**Feature solicitada**: $ARGUMENTS

Sigue este proceso:

1. **Consulta al agente de optometría** para validar que la feature tiene sentido para el negocio y define el flujo de usuario correcto.

2. **Diseña la arquitectura** considerando:
   - Tablas nuevas o campos nuevos requeridos (con SQL de migración)
   - Server Actions necesarias (naming: `obtener*`, `crear*`, `actualizar*`, `eliminar*`)
   - Componentes: cuáles son Server, cuáles Client
   - Páginas: rutas en `/dashboard/[modulo]/`

3. **Genera el plan de implementación** en orden de dependencias:
   - Primero migración SQL
   - Luego Server Actions (backend)
   - Luego página principal (Server Component)
   - Luego componentes interactivos (Client Components)

4. **Lista los edge cases** que el agente de QA debe verificar.

5. **Evalúa riesgos de seguridad** relevantes (tenant isolation, validaciones, RLS).

Responde con un plan claro y accionable antes de escribir cualquier código.
