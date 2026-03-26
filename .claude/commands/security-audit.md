Ejecuta una auditoría de seguridad del sistema o del módulo especificado.

**Alcance**: $ARGUMENTS (si vacío, auditar toda la app)

Usa el agente de seguridad para revisar:

1. **Tenant isolation** — buscar queries sin `tenant_id` filter:
   ```
   grep -r "supabase.from(" src/ --include="*.ts" --include="*.tsx"
   ```
   Verificar que cada `.from()` tenga `.eq("tenant_id", ...)` o que sea una tabla que no requiere tenant filter.

2. **Autenticación** — verificar que no se use `getSession()` en lugar de `getUser()` en Server Actions.

3. **RLS policies** — listar tablas y verificar que todas tengan RLS habilitado en Supabase.

4. **Variables de entorno** — verificar que no hay secretos expuestos en código.

5. **Input validation** — revisar que los datos de FormData se validan antes de usar en queries.

6. **N+1 queries y performance** — detectar loops con queries dentro.

7. **Headers de seguridad** — verificar configuración en `next.config.ts`.

Genera un reporte con:
- Vulnerabilidades críticas (bloqueantes para producción)
- Vulnerabilidades altas (resolver antes del próximo release)
- Mejoras de performance recomendadas
- SQL de índices sugeridos
