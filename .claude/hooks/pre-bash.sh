#!/bin/bash
# Hook: PreToolUse → Bash
# Ejecuta antes de cualquier comando bash de Claude.
# 1. Bloquea git commit/push si TypeScript tiene errores.
# 2. Bloquea git push si no hay QA stamp válido (< 2 horas).

INPUT=$(cat)
CMD=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except:
    print('')
" 2>/dev/null || echo "")

PROJECT=/c/saas_optica

# ── 1. TypeScript check antes de commit o push ─────────────────────────────
# Regex preciso: git commit/push como comando real, no como substring en echo/strings
if echo "$CMD" | grep -qE "(^|&&\s*|;\s*)git (commit|push)"; then
  echo "[HOOK TSC] Verificando TypeScript..."
  cd "$PROJECT" && npx tsc --noEmit 2>&1
  TSC_EXIT=$?
  if [ $TSC_EXIT -ne 0 ]; then
    echo ""
    echo "[HOOK TSC] ✗ BLOQUEADO — Errores de TypeScript detectados."
    echo "Corrige los errores antes de hacer commit."
    exit 1
  fi
  echo "[HOOK TSC] ✓ TypeScript sin errores"
fi

# ── 2. QA stamp obligatorio antes de push ──────────────────────────────────
if echo "$CMD" | grep -qE "(^|&&\s*|;\s*)git push"; then
  QA_STAMP="$PROJECT/.qa-stamp"

  if [ ! -f "$QA_STAMP" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  [HOOK QA] ✗  PUSH BLOQUEADO — QA no ejecutado      ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  Para desbloquear:                                   ║"
    echo "║    1. Ejecuta el skill /qa-check                     ║"
    echo "║    2. Resuelve todos los hallazgos críticos y altos  ║"
    echo "║    3. El QA stamp se crea automáticamente al final   ║"
    echo "╚══════════════════════════════════════════════════════╝"
    exit 2
  fi

  STAMP=$(cat "$QA_STAMP" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  DIFF=$((NOW - STAMP))
  MAX_AGE=7200  # 2 horas

  if [ "$DIFF" -gt "$MAX_AGE" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  [HOOK QA] ✗  PUSH BLOQUEADO — QA stamp expirado    ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  El QA fue aprobado hace más de 2 horas.             ║"
    echo "║  Ejecuta /qa-check nuevamente antes de deployar.     ║"
    echo "╚══════════════════════════════════════════════════════╝"
    exit 2
  fi

  MINS=$((DIFF / 60))
  echo "[HOOK QA] ✓ QA aprobado hace ${MINS} min — Push permitido"
fi

exit 0
