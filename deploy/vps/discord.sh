#!/usr/bin/env bash
# Avisos a Discord desde la VPS. Se usa con `source`:
#
#   . deploy/vps/discord.sh
#   discord info|warn|error "Título" "texto opcional"
#
# Lee del entorno DISCORD_WEBHOOK_URL (sin ella no hace nada), DISCORD_PING_USER (te menciona sólo en los
# errores) y BYOX_INSTANCE_NAME. Nunca falla: un aviso que no sale no debe romper un backup.

_discord_color() {
  case "$1" in error) echo 15548997 ;; warn) echo 16426522 ;; *) echo 3908957 ;; esac
}
_discord_icon() {
  case "$1" in error) echo "🔥" ;; warn) echo "⚠️" ;; *) echo "ℹ️" ;; esac
}

# Texto -> contenido de un string JSON: sin caracteres de control, recortado y con escapes.
_discord_esc() {
  local s max="$2"
  s="$(printf '%s' "$1" | tr -d '\000-\010\013-\037')"
  s="${s:0:max}"
  # Con locale C el recorte es por bytes y puede partir un carácter: iconv -c descarta lo que quedó a medias.
  if command -v iconv >/dev/null 2>&1; then s="$(printf '%s' "$s" | iconv -c -f UTF-8 -t UTF-8 2>/dev/null)"; fi
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\t'/ }"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

discord_valid() {
  [[ "${DISCORD_WEBHOOK_URL:-}" =~ ^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$ ]]
}

# El JSON que se manda. `allowed_mentions` vacío: nada de lo que viaje en el texto puede mencionar a nadie.
discord_payload() {
  local level="${1:-info}" title="${2:-}" text="${3:-}" ping="" content="" users=""
  if [ "$level" = error ] && [[ "${DISCORD_PING_USER:-}" =~ ^[0-9]{15,25}$ ]]; then
    ping="$DISCORD_PING_USER"
    content="\"content\":\"<@$ping>\","
    users="\"$ping\""
  fi
  local footer
  footer="${BYOX_INSTANCE_NAME:-byox} · $(hostname 2>/dev/null || echo vps)"
  printf '{"username":"byox",%s"allowed_mentions":{"parse":[],"users":[%s]},"embeds":[{"title":"%s","description":"%s","color":%s,"footer":{"text":"%s"},"timestamp":"%s"}]}' \
    "$content" "$users" \
    "$(_discord_esc "$(_discord_icon "$level") $title" 250)" \
    "$(_discord_esc "$text" 1500)" \
    "$(_discord_color "$level")" \
    "$(_discord_esc "$footer" 80)" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

# Manda el aviso y devuelve el estado de curl (para el instalador, que sí quiere saber si salió).
discord_post() {
  discord_valid || return 2
  command -v curl >/dev/null 2>&1 || return 3
  curl -fsS -m 10 -H 'Content-Type: application/json' -d "$(discord_payload "$@")" "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1
}

discord() {
  discord_post "$@" || true
  return 0
}
