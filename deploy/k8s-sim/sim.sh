#!/usr/bin/env bash
# Simula las dos VPS de byox en un cluster kind local:
#   VPS A  (worker  de kind): Postgres + Forgejo + MCP/web
#   VPS B  (worker2 de kind): runner-N de Forgejo + su Docker
#   VPS B2 (worker3 de kind): otro runner-N con su propio Docker
#
#   ./sim.sh up        crea el cluster, construye el MCP, instala todo y prepara Forgejo
#   ./sim.sh test      comprueba la topología, los runners en paralelo y un curso de punta a punta
#   ./sim.sh status    pods por nodo y consumo de cada "VPS"
#   ./sim.sh scale N   cambia la cantidad de runners (una por VPS de tipo B)
#   ./sim.sh reset     borra el cluster y lo vuelve a crear (kind no suma nodos a uno que ya existe)
#   ./sim.sh down      borra el cluster
#
# Tamaño de cada VPS: VPS_MEM=2g VPS_CPUS=2 (por defecto). NO_BUILD=1 reutiliza la imagen del MCP.
set -euo pipefail
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1  # Git Bash en Windows: no tocar rutas tipo /data

CLUSTER=byox-sim
CTX="kind-$CLUSTER"
NS=byox
NODE_A="$CLUSTER-worker"
NODE_B="$CLUSTER-worker2"
NODE_B2="$CLUSTER-worker3"
VPS_MEM="${VPS_MEM:-2g}"
VPS_CPUS="${VPS_CPUS:-2}"
BYOX_USER=owner
BYOX_BOT=byox
BYOX_ORG=cursos

# Siempre con --context: no se toca el contexto activo de kubectl.
kc() { kubectl --context "$CTX" "$@"; }
k() { kc -n "$NS" "$@"; }
rand() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n' | cut -c1-"$1"; }
fj() { k exec deploy/forgejo -- su-exec git forgejo "$@"; }
secret_val() { k get secret "$1" -o "jsonpath={.data.$2}" | base64 -d; }
say() { printf '\n→ %s\n' "$*"; }

up() {
  command -v kind >/dev/null && command -v kubectl >/dev/null || { echo "Hacen falta kind y kubectl." >&2; exit 1; }

  if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
    say "Creando el cluster $CLUSTER (control-plane + 2 workers)"
    local prev; prev="$(kubectl config current-context 2>/dev/null || true)"
    kind create cluster --config kind.yaml
    # kind deja activo el contexto nuevo: se devuelve el que tenías.
    [ -n "$prev" ] && [ "$prev" != "$CTX" ] && kubectl config use-context "$prev" >/dev/null
  fi
  if ! docker inspect "$NODE_B2" >/dev/null 2>&1; then
    echo "El cluster $CLUSTER es de antes de la VPS B2 (kind no suma nodos a uno que ya existe)." >&2
    echo "Recrealo con: ./sim.sh reset" >&2
    exit 1
  fi
  say "Cada VPS: $VPS_MEM de RAM y $VPS_CPUS CPU"
  docker update --memory "$VPS_MEM" --memory-swap "$VPS_MEM" --cpus "$VPS_CPUS" "$NODE_A" "$NODE_B" "$NODE_B2" >/dev/null

  say "Imagen del MCP"
  if [ -z "${NO_BUILD:-}" ] || ! docker image inspect byox-mcp:sim >/dev/null 2>&1; then
    docker build -q -t byox-mcp:sim ../../mcp
  fi
  kind load docker-image byox-mcp:sim --name "$CLUSTER"

  say "Namespace, contraseñas de la base y Postgres"
  kc apply -f manifests/00-namespace.yaml >/dev/null
  if ! k get secret byox-db >/dev/null 2>&1; then
    k create secret generic byox-db \
      --from-literal=POSTGRES_PASSWORD="$(rand 32)" \
      --from-literal=FORGEJO_DB_PASSWORD="$(rand 32)" \
      --from-literal=BYOX_DB_PASSWORD="$(rand 32)" >/dev/null
  fi
  k create configmap pg-init --from-file=init-db.sh=../../scripts/init-db.sh --dry-run=client -o yaml | k apply -f - >/dev/null
  k apply -f manifests/10-postgres.yaml >/dev/null
  k rollout status statefulset/postgres --timeout=300s

  say "Forgejo (VPS A)"
  k apply -f manifests/20-forgejo.yaml >/dev/null
  k rollout status deploy/forgejo --timeout=600s

  bootstrap
  runner_token

  say "Runners (VPS B y B2), MCP (VPS A) y firewall"
  # Si el MCP ya corría, la imagen nueva (mismo tag) no se toma sola: se reinicia después de aplicar.
  local mcp_before; mcp_before="$(k get deploy mcp -o name 2>/dev/null || true)"
  k apply -f manifests/40-runner.yaml -f manifests/30-mcp.yaml -f manifests/50-netpol.yaml >/dev/null
  [ -z "$mcp_before" ] || k rollout restart deploy/mcp >/dev/null
  k rollout status deploy/mcp --timeout=300s
  k rollout status statefulset/runner --timeout=600s
  # Limpieza de registros viejos de runners (lo agrega manifests/45-runner-prune.yaml si existe).
  [ ! -f manifests/45-runner-prune.yaml ] || k apply -f manifests/45-runner-prune.yaml >/dev/null

  cat <<EOF

Listo.
  App:      http://localhost:13333/app   (usuario: $BYOX_USER, contraseña: ./sim.sh password)
  Forgejo:  http://localhost:13000
  ./sim.sh test      para comprobar la topología y correr un curso
EOF
}

# Usuario, bot, tokens y organización: lo mismo que hace setup.sh con docker compose.
bootstrap() {
  say "Preparando Forgejo (usuario, bot, tokens, organización)"
  user_exists() { fj admin user list | awk 'NR>1 {print $2}' | grep -qx "$1"; }
  if ! k get secret byox-app >/dev/null 2>&1; then
    local pass; pass="$(rand 24)"
    user_exists "$BYOX_USER" || fj admin user create --admin --username "$BYOX_USER" --email "$BYOX_USER@byox.localhost" \
      --password "$pass" --must-change-password=false >/dev/null
    user_exists "$BYOX_BOT" || fj admin user create --username "$BYOX_BOT" --email "$BYOX_BOT@byox.localhost" \
      --password "$(rand 24)" --must-change-password=false >/dev/null
    local tok bot
    tok="$(fj admin user generate-access-token --username "$BYOX_USER" --token-name "byox-mcp-$(rand 6)" --scopes all --raw | tr -d '\r\n')"
    bot="$(fj admin user generate-access-token --username "$BYOX_BOT" --token-name "byox-actions-$(rand 6)" --scopes all --raw | tr -d '\r\n')"
    k create secret generic byox-admin --from-literal=password="$pass" >/dev/null
    k create secret generic byox-app \
      --from-literal=BYOX_USER="$BYOX_USER" --from-literal=BYOX_TOKEN="$tok" \
      --from-literal=BYOX_BOT="$BYOX_BOT" --from-literal=BYOX_BOT_TOKEN="$bot" \
      --from-literal=BYOX_ORG="$BYOX_ORG" >/dev/null
  fi
  local tok; tok="$(secret_val byox-app BYOX_TOKEN)"
  if ! k exec deploy/forgejo -- curl -fsS -o /dev/null -H "Authorization: token $tok" "http://localhost:3000/api/v1/orgs/$BYOX_ORG" 2>/dev/null; then
    k exec deploy/forgejo -- curl -fsS -o /dev/null -X POST -H "Authorization: token $tok" -H 'Content-Type: application/json' \
      "http://localhost:3000/api/v1/orgs" \
      -d "{\"username\":\"$BYOX_ORG\",\"visibility\":\"limited\",\"description\":\"Fuentes de los cursos\"}"
  fi
}

# Token de registro de la instancia. Cada pod del runner lo usa en su initContainer para registrarse con su propio
# uuid y token: acá no se registra ningún runner.
runner_token() {
  k get secret runner-registration >/dev/null 2>&1 && return
  say "Token de registro de runners"
  k create secret generic runner-registration     --from-literal=token="$(fj forgejo-cli actions generate-runner-token | tr -d '
')" >/dev/null
}

status() {
  k get pods -o wide
  echo
  docker stats --no-stream --format 'VPS {{.Name}}: {{.MemUsage}} ({{.MemPerc}}), CPU {{.CPUPerc}}' "$NODE_A" "$NODE_B" "$NODE_B2"
}

scale() {
  local n="${1:?uso: ./sim.sh scale N}"
  k scale statefulset/runner --replicas="$n"
  # Con más réplicas que VPS de tipo B, las que sobran quedan Pending (anti-afinidad): no se espera a que estén listas.
  k rollout status statefulset/runner --timeout=300s || true
}

down() {
  kind delete cluster --name "$CLUSTER"
  docker rmi byox-mcp:sim >/dev/null 2>&1 || true
}

case "${1:-}" in
  up) up ;;
  status) status ;;
  scale) scale "${2:-}" ;;
  down) down ;;
  reset) down; up ;;
  password) secret_val byox-admin password; echo ;;
  test) source ./test.sh ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
