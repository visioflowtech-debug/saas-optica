Prepara y ejecuta el proceso completo de versionado y deploy a producción.

**Descripción del release (opcional)**: $ARGUMENTS

Sigue estos pasos en orden:

1. **QA rápido** — revisar que no hay errores obvios:
   ```bash
   git diff --name-only HEAD  # archivos modificados sin commitear
   ```

2. **Verificar build local** (si hay cambios en tipos o imports):
   ```bash
   npx tsc --noEmit
   ```

3. **Stagear archivos** — solo los archivos del proyecto (excluir `.claude/`, `lint.txt`, `*.log`):
   - Archivos modificados en `src/`
   - Archivos nuevos en `src/` y `src/components/`
   - Migraciones SQL nuevas en `supabase/migrations/`

4. **Generar mensaje de commit** descriptivo con:
   - Prefijo: `feat:`, `fix:`, `refactor:`, `perf:` según el tipo
   - Lista de cambios principales
   - Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

5. **Push a main**:
   ```bash
   git push origin main
   ```

6. **Verificar en Vercel** que el deploy se inició (el push a main dispara automáticamente).

7. **Si hay migraciones SQL nuevas**, recordar al usuario que debe ejecutarlas manualmente en el Supabase SQL Editor antes o después del deploy.

Reportar: commit hash, archivos incluidos, y URL de Vercel para monitorear el deploy.
