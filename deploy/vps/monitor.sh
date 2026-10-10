#!/usr/bin/env bash
# Vigilante de la VPS, pensado para cron cada 5 minutos (lo instala install-alerts.sh). Avisa a Discord sólo cuando
# algo cambia: tras DOS revisiones seguidas mal, un recordatorio cada 6 h si sigue mal, y "recuperado" al volver.
#
# Revisa: disco, memoria y swap, contenedores de compose, byox y Forgejo por HTTPS, vencimiento de los
# certificados, antigüedad del último backup y si hay un reinicio pendiente.
set -uo pipefail

BYOX_DIR="${BYOX_DIR:-$HOME/byox}"
STATE_DIR="${MONITOR_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/byox-monitor}"
REALERT_SECS="${REALERT_SECS:-21600}"
DISK_ALERT_PCT="${DISK_ALERT_PCT:-85}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=discord.sh
. "$HERE/discord.sh"

# report <nombre> <info|warn|error> <ok|bad> [texto]
report() {
  local name="$1" level="$2" status="$3" text="${4:-}"
  local f="$STATE_DIR/${name// /_}" fails=0 alerted=0 now
  now="${MONITOR_NOW:-$(date +%s)}"
  mkdir -p "$STATE_DIR"
  if [ -f "$f" ]; then read -r fails alerted < "$f" || true; fi
  if [ "$status" = bad ]; then
    fails=$((fails + 1))
    if [ "$fails" -ge 2 ] && { [ "$alerted" -eq 0 ] || [ $((now - alerted)) -ge "$REALERT_SECS" ]; }; then
      discord "$level" "$name: con problemas" "$text"
      alerted="$now"
    fi
    echo "$fails $alerted" > "$f"
  else
    if [ "$alerted" -gt 0 ]; then discord info "$name: recuperado"; fi
    rm -f "$f"
  fi
}

check_disk() {
  local used
  used="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
  if [ "${used:-0}" -ge "$DISK_ALERT_PCT" ]; then
    report Disco error bad "${used}% usado (aviso desde ${DISK_ALERT_PCT}%). Prueba: docker system df"
  else
    report Disco error ok
  fi
}

check_memory() {
  local avail swap_pct
  avail="$(awk '/MemAvailable/{a=$2} /MemTotal/{t=$2} END{printf "%d", a*100/t}' /proc/meminfo)"
  swap_pct="$(awk '/SwapTotal/{t=$2} /SwapFree/{f=$2} END{ if (t>0) printf "%d", (t-f)*100/t; else print 0 }' /proc/meminfo)"
  if [ "$avail" -lt 10 ] || [ "$swap_pct" -gt 50 ]; then
    report Memoria warn bad "Disponible: ${avail}%. Swap usada: ${swap_pct}%. Baja la capacidad del runner o sube la VPS."
  else
    report Memoria warn ok
  fi
}

check_containers() {
  local want have missing
  want="$(docker compose config --services 2>/dev/null | sort)"
  have="$(docker compose ps --status running --services 2>/dev/null | sort)"
  missing="$(comm -23 <(printf '%s\n' "$want") <(printf '%s\n' "$have") | tr '\n' ' ')"
  if [ -z "$want" ]; then
    report Contenedores error bad "No pude leer el estado de docker compose."
  elif [ -n "${missing// /}" ]; then
    report Contenedores error bad "No están corriendo: $missing"
  else
    report Contenedores error ok
  fi
}

check_http() {
  local name="$1" url="$2" expect="$3"
  if curl -fsS -m 10 "$url" 2>/dev/null | grep -q "$expect"; then report "$name" error ok; else report "$name" error bad "No responde bien: $url"; fi
}

check_cert() {
  local name="$1" url="$2" host
  host="${url#https://}"
  host="${host%%/*}"
  # Caddy renueva solo: si faltan menos de 10 días, algo falló.
  if echo | timeout 15 openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -checkend 864000 >/dev/null 2>&1; then
    report "$name" error ok
  else
    report "$name" error bad "El certificado de $host vence en menos de 10 días o no se pudo leer."
  fi
}

check_backup() {
  local dir="${BACKUP_DIR:-$HOME/backups}"
  # Sólo si ya hubo alguna copia: antes de la primera no hay nada que comparar.
  find "$dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | grep -q . || return 0
  if find "$dir" -mindepth 1 -maxdepth 1 -type d -mmin -2160 | grep -q .; then
    report Backup error ok
  else
    report Backup error bad "La última copia tiene más de 36 horas. Mira ~/backup.log."
  fi
}

check_reboot() {
  if [ -f /var/run/reboot-required ]; then
    report "Reinicio pendiente" warn bad "Hay actualizaciones que piden reiniciar: sudo reboot (los servicios vuelven solos)."
  else
    report "Reinicio pendiente" warn ok
  fi
}

main() {
  cd "$BYOX_DIR" || exit 0
  if [ -f .env ]; then set -a; . ./.env; set +a; fi
  check_disk
  check_memory
  check_containers
  if [ -n "${BYOX_WEB_URL:-}" ]; then
    check_http "byox (web)" "$BYOX_WEB_URL/health" '^ok$'
    case "$BYOX_WEB_URL" in https://*) check_cert "Certificado (app)" "$BYOX_WEB_URL" ;; esac
  fi
  if [ -n "${BYOX_PUBLIC_URL:-}" ]; then
    check_http "Forgejo (web)" "$BYOX_PUBLIC_URL/api/healthz" '"status": *"pass"'
    case "$BYOX_PUBLIC_URL" in https://*) check_cert "Certificado (git)" "$BYOX_PUBLIC_URL" ;; esac
  fi
  check_backup
  check_reboot
}

# Se puede incluir con `source` (los tests lo hacen) sin que corra nada.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
