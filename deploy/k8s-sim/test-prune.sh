#!/usr/bin/env bash
# Comprueba la limpieza de runners viejos (manifests/45-runner-prune.yaml):
#   1. Recrear runner-1 deja un registro offline duplicado; el prune lo borra y deja los dos runners online.
#   2. Un runner caído SIN duplicado (StatefulSet a 1 réplica) no se borra.
#   3. Al volver (a 2 réplicas) se registra de nuevo, queda un duplicado offline y el prune lo borra.
# Tarda unos 6-8 minutos: Forgejo tarda ~1m30 en pasar un runner de idle a offline, dos veces.
# Pausa el CronJob mientras corre (para que no borre el duplicado antes de verlo) y lo reactiva al terminar; el
# StatefulSet vuelve a 2 réplicas aunque el script falle.
#
#   ./test-prune.sh
set -uo pipefail
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1  # Git Bash en Windows: no tocar rutas tipo /data

CTX=kind-byox-sim
NS=byox
kc() { kubectl --context "$CTX" "$@"; }
k() { kc -n "$NS" "$@"; }
secret_val() { k get secret "$1" -o "jsonpath={.data.$2}" | base64 -d; }
say() { printf '\n→ %s\n' "$*"; }

PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$*"; }
bad() { FAIL=$((FAIL + 1)); printf '  ✗ %s\n' "$*"; }
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }

ADMIN_TOKEN="$(secret_val byox-app BYOX_TOKEN)"
api() { k exec deploy/forgejo -c forgejo -- curl -fsS -H "Authorization: token $ADMIN_TOKEN" "$@"; }
FJ=http://localhost:3000/api/v1
# "runner-1 offline" por línea, ordenado por id.
runners() { api "$FJ/admin/actions/runners?limit=50" | sed 's/},{/}\n{/g' \
  | sed -n 's/.*"id":\([0-9]*\),.*"name":"\([^"]*\)","status":"\([^"]*\)".*/\1 \2 \3/p' | sort -n; }
# n_runners NOMBRE ESTADO   (ESTADO "online" = idle o active)
n_runners() {
  if [ "$2" = online ]; then runners | awk -v n="$1" '$2 == n && $3 != "offline"' | grep -c . || true
  else runners | awk -v n="$1" -v s="$2" '$2 == n && $3 == s' | grep -c . || true; fi
}
show() { runners | sed 's/^/      /'; }

# wait_for SEGUNDOS "descripción" comando…   (reintenta cada 5 s)
wait_for() {
  local t="$1" d="$2"; shift 2
  local i
  for ((i = 0; i < t; i += 5)); do "$@" >/dev/null 2>&1 && return 0; sleep 5; done
  echo "      timeout esperando: $d"; return 1
}

# Dispara el CronJob a mano y espera a que termine; muestra el log.
JOBN=0
prune() {
  JOBN=$((JOBN + 1))
  local job="prune-test-$$-$JOBN"
  k create job "$job" --from=cronjob/runner-prune >/dev/null || return 1
  k wait --for=condition=complete "job/$job" --timeout=120s >/dev/null || { k logs "job/$job" | sed 's/^/      /'; return 1; }
  k logs "job/$job" | grep -E 'borrando|listo' | sed 's/^/      /'
  k delete job "$job" >/dev/null
}

pod_uid() { k get pod "$1" -o jsonpath='{.metadata.uid}' 2>/dev/null; }
pod_ready() { [ "$(k get pod "$1" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = True ]; }
# Pod nuevo (otro uid que $2) y Ready.
new_pod_ready() { local u; u="$(pod_uid "$1")"; [ -n "$u" ] && [ "$u" != "$2" ] && pod_ready "$1"; }

has_duplicate() { [ "$(n_runners runner-1 offline)" -ge 1 ] && [ "$(n_runners runner-1 online)" -ge 1 ]; }
only_offline() { [ "$(n_runners runner-1 offline)" -eq 1 ] && [ "$(n_runners runner-1 online)" -eq 0 ]; }
is_online() { [ "$(n_runners runner-1 online)" -ge 1 ]; }
pod_gone() { ! k get pod runner-1; }

cleanup() {
  echo; say "Restaurando el cluster"
  k scale statefulset/runner --replicas=2 >/dev/null
  k patch cronjob runner-prune -p '{"spec":{"suspend":false}}' >/dev/null
  k delete job -l app=runner-prune >/dev/null 2>&1 || true
  local j; for j in $(k get job -o name | grep prune-test-); do k delete "$j" >/dev/null 2>&1; done
}
trap cleanup EXIT

check "el CronJob runner-prune existe" k get cronjob runner-prune
check "concurrencyPolicy Forbid" test "$(k get cronjob runner-prune -o jsonpath='{.spec.concurrencyPolicy}')" = Forbid
k patch cronjob runner-prune -p '{"spec":{"suspend":true}}' >/dev/null

say "Punto de partida: runner-0 y runner-1 online, sin duplicados"
prune >/dev/null
check "runner-0 online" test "$(n_runners runner-0 online)" -eq 1
check "runner-1 online" test "$(n_runners runner-1 online)" -eq 1
check "sin registros offline" test "$(runners | grep -c ' offline$' || true)" -eq 0
show

say "1. Recrear runner-1 -> registro viejo offline duplicado"
OLD="$(pod_uid runner-1)"
k delete pod runner-1 --wait=true >/dev/null
if wait_for 300 "runner-1 nuevo Ready" new_pod_ready runner-1 "$OLD"; then ok "runner-1 recreado y Ready"; else bad "runner-1 no volvió"; fi
if wait_for 300 "registro viejo offline y nuevo online" has_duplicate; then
  ok "hay un runner-1 offline duplicado y otro online"
else
  bad "no apareció el duplicado offline"
fi
show
BEFORE="$(n_runners runner-1 offline)"
prune
check "el runner-1 offline duplicado desapareció (había $BEFORE)" test "$(n_runners runner-1 offline)" -eq 0
check "runner-1 online sigue" test "$(n_runners runner-1 online)" -eq 1
check "runner-0 online sigue" test "$(n_runners runner-0 online)" -eq 1
show

say "2. runner-1 caído sin duplicado -> no se borra"
k scale statefulset/runner --replicas=1 >/dev/null
wait_for 120 "pod runner-1 eliminado" pod_gone || true
if wait_for 300 "runner-1 offline" only_offline; then
  ok "runner-1 pasó a offline (único registro con ese nombre)"
else
  bad "runner-1 no pasó a offline"
fi
show
prune
check "el runner-1 offline SIN duplicado se conserva" test "$(n_runners runner-1 offline)" -eq 1
check "runner-0 online sigue" test "$(n_runners runner-0 online)" -eq 1

say "3. runner-1 vuelve (se registra de nuevo) -> el viejo offline se borra"
k scale statefulset/runner --replicas=2 >/dev/null
wait_for 300 "runner-1 Ready" pod_ready runner-1 && ok "runner-1 Ready otra vez" || bad "runner-1 no volvió"
wait_for 120 "runner-1 nuevo online" is_online || true
show
prune
check "no quedan runners offline" test "$(runners | grep -c ' offline$' || true)" -eq 0
check "runner-0 y runner-1 online (2 registrados)" test "$(runners | wc -l)" -eq 2
show

echo
echo "$PASS bien, $FAIL mal"
[ "$FAIL" -eq 0 ]
