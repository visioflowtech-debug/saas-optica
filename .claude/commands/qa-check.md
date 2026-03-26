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

## 6. GATE DE APROBACIÓN (obligatorio al final)

Al terminar la revisión, evalúa si los cambios son seguros para producción:

**Si no hay hallazgos Críticos ni Altos sin resolver:**
```bash
echo $(date +%s) > /c/saas_optica/.qa-stamp
echo "✅ QA APROBADO — stamp creado. Push a producción desbloqueado por 2 horas."
```

**Si hay hallazgos Críticos o Altos pendientes:**
```bash
echo "❌ QA NO APROBADO — resuelve los hallazgos críticos/altos antes de deployar."
# NO crear el .qa-stamp
```

El archivo `.qa-stamp` es verificado por el hook `pre-bash.sh` antes de permitir `git push`.
Sin este stamp (o con uno de más de 2 horas), el push queda bloqueado automáticamente.
