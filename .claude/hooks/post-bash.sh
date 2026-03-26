#!/bin/bash
# Hook: PostToolUse → Bash
# Ejecuta después de cualquier comando bash de Claude.
# 1. Registra cada push en deploy.log con timestamp y commit hash.
# 2. Invalida el QA stamp para forzar nuevo QA en el próximo deploy.

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

if echo "$CMD" | grep -qE "(^|&&\s*|;\s*)git push"; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  COMMIT=$(cd "$PROJECT" && git log --oneline -1 2>/dev/null || echo "unknown")
  BRANCH=$(cd "$PROJECT" && git branch --show-current 2>/dev/null || echo "unknown")

  LOG_LINE="[$TIMESTAMP] branch=$BRANCH | $COMMIT"
  echo "$LOG_LINE" >> "$PROJECT/deploy.log" 2>/dev/null

  # Invalidar QA stamp — el próximo deploy requiere nuevo QA
  rm -f "$PROJECT/.qa-stamp" 2>/dev/null

  echo "[HOOK LOG] Deploy registrado → deploy.log"
  echo "[HOOK LOG] QA stamp invalidado — próximo push requerirá nuevo /qa-check"
fi

exit 0
