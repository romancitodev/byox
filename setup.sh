#!/usr/bin/env bash
# Primer arranque de byox: crea tu usuario, el bot, los tokens, registra el
# runner y levanta todo. Se puede volver a correr: lo que ya existe se saltea.
set -euo pipefail
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1  # Git Bash en Windows: no tocar rutas tipo /data

[ -f .env ] && set -a && . ./.env && set +a
BYOX_USER="${BYOX_USER:-admin}"
BYOX_BOT="${BYOX_BOT:-byox}"
BYOX_ORG="${BYOX_ORG:-cursos}"

# Sin `tr </dev/urandom | head`: con pipefail, el SIGPIPE de tr corta el script.
rand() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n' | cut -c1-"$1"; }
fj() { docker compose exec -T -u git forgejo forgejo "$@"; }
api() { curl -fsS -H "Authorization: token $BYOX_TOKEN" -H 'Content-Type: application/json' "$@"; }

echo "→ Levantando Forgejo"
docker compose up -d forgejo
until curl -fs http://localhost:3000/api/healthz >/dev/null 2>&1; do sleep 1; done

user_exists() { fj admin user list | awk 'NR>1 {print $2}' | grep -qx "$1"; }

if ! user_exists "$BYOX_USER"; then
  echo "→ Creando tu usuario: $BYOX_USER"
  BYOX_PASSWORD="$(rand 24)"
  fj admin user create --admin --username "$BYOX_USER" --email "$BYOX_USER@byox.localhost" \
    --password "$BYOX_PASSWORD" --must-change-password=false >/dev/null
fi
if ! user_exists "$BYOX_BOT"; then
  echo "→ Creando el bot: $BYOX_BOT"
  fj admin user create --username "$BYOX_BOT" --email "$BYOX_BOT@byox.localhost" \
    --password "$(rand 24)" --must-change-password=false >/dev/null
fi
if [ -z "${BYOX_TOKEN:-}" ]; then
  BYOX_TOKEN="$(fj admin user generate-access-token --username "$BYOX_USER" --token-name "byox-mcp-$(rand 6)" --scopes all --raw | tr -d '\r\n')"
fi
if [ -z "${BYOX_BOT_TOKEN:-}" ]; then
  BYOX_BOT_TOKEN="$(fj admin user generate-access-token --username "$BYOX_BOT" --token-name "byox-actions-$(rand 6)" --scopes all --raw | tr -d '\r\n')"
fi

# Se vuelven a escribir sólo las claves que genera este script: lo que agregaste a mano (BYOX_SIGNUP, BYOX_PUBLIC_URL…) se conserva.
touch .env
grep -vE '^(BYOX_USER|BYOX_PASSWORD|BYOX_TOKEN|BYOX_BOT|BYOX_BOT_TOKEN|BYOX_ORG)=' .env > .env.tmp || true
cat >> .env.tmp <<EOF
BYOX_USER=$BYOX_USER
BYOX_PASSWORD=${BYOX_PASSWORD:-}
BYOX_TOKEN=$BYOX_TOKEN
BYOX_BOT=$BYOX_BOT
BYOX_BOT_TOKEN=$BYOX_BOT_TOKEN
BYOX_ORG=$BYOX_ORG
EOF
mv .env.tmp .env
chmod 600 .env 2>/dev/null || true

if ! api "http://localhost:3000/api/v1/orgs/$BYOX_ORG" >/dev/null 2>&1; then
  echo "→ Creando la organización de cursos: $BYOX_ORG"
  api -X POST http://localhost:3000/api/v1/orgs \
    -d "{\"username\":\"$BYOX_ORG\",\"visibility\":\"private\",\"description\":\"Fuentes de los cursos\"}" >/dev/null
fi

if [ ! -f data/runner/config.yml ]; then
  echo "→ Registrando el runner"
  secret="$(rand 40)"
  uuid="$(fj forgejo-cli actions register --name byox-runner --secret "$secret" | tr -d '\r' | tail -n1)"
  mkdir -p data/runner
  cat > data/runner/config.yml <<EOF
log:
  level: info
runner:
  capacity: 2
  timeout: 1h
  labels:
    - "docker:docker://node:22-bookworm"
container:
  # Los jobs corren en la red de compose para llegar a http://forgejo:3000
  network: byox
  force_pull: false
  # Las cachés de cada curso (cargo, pip…) que monta el job de tests.
  valid_volumes:
    - "byox-cache-*"
server:
  connections:
    forgejo:
      url: http://forgejo:3000/
      uuid: $uuid
      token: $secret
EOF
fi

echo "→ Levantando runner y MCP"
docker compose up -d --build

cat <<EOF

Listo.
  App:      http://localhost:3333/app   (usuario: $BYOX_USER${BYOX_PASSWORD:+, contraseña en .env})
  Forgejo:  http://localhost:3000       (la misma cuenta)

Entra a la app, abre Cuenta → Tokens, crea un token y conecta tu asistente:
  claude mcp add --transport http byox http://localhost:3333/mcp --header "Authorization: Bearer <tu token>"

Para sumar a otras personas: BYOX_SIGNUP=invite en .env (o crea sus cuentas) y docker compose up -d.
Guía completa: http://localhost:3333/docs
EOF
