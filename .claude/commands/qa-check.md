Ejecuta una revisión de QA completa sobre los cambios recientes o el módulo especificado.

**Módulo o archivos a revisar**: $ARGUMENTS

Usa el agente de QA para:

1. **Revisar los archivos modificados** según `git diff --name-only HEAD~1` (o los especificados).

2. **Aplicar el checklist completo**:
   - Autenticación y tenant isolation en Server Actions
   - Manejo de errores y edge cases
   - Timezone El Salvador (filtros con svFechaInicioUTC/svFechaFinUTC)
   - Consistencia de KPIs y cálculos financieros
   - Estado y efectos en componentes cliente
   - UX móvil

3. **Verificar los flujos críticos** afectados por el cambio:
   - Flujo de venta (si aplica)
   - Flujo de laboratorio (si aplica)
   - Flujo de campaña (si aplica)

4. **Reportar hallazgos** ordenados por severidad (Crítica > Alta > Media > Baja).

5. **Proponer fixes** con código específico para cada hallazgo.

Si no se especifica módulo, revisar todos los archivos en `git status` que están staged.
