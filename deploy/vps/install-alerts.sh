#!/usr/bin/env bash
# Activa los avisos de la VPS a Discord. Correr como el usuario `deploy`, con DISCORD_WEBHOOK_URL ya en .env:
#
#   ./deploy/vps/install-alerts.sh
#
# Manda un mensaje de prueba y, si llegó, deja puesto (se puede repetir sin duplicar nada):
#   - cron cada 5 min con monitor.sh
#   - cron diario con backup.sh, que avisa si salió bien o falló
#   - un aviso en cada inicio de sesión SSH (~/.ssh/rc)
set -euo pipefail

BYOX_DIR="${BYOX_DIR:-$HOME/byox}"
cd "$BYOX_DIR"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
. deploy/vps/discord.sh

if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
  echo "Falta DISCORD_WEBHOOK_URL en $BYOX_DIR/.env." >&2
  echo "Creá el webhook en Discord (Ajustes del servidor → Integraciones → Webhooks) y agregá la línea a .env." >&2
  exit 1
fi
if ! discord_valid; then
  echo "DISCORD_WEBHOOK_URL no parece un webhook de Discord (https://discord.com/api/webhooks/<id>/<token>)." >&2
  exit 1
fi
if ! discord_post info "Avisos de la VPS activados" "Desde ahora llegan acá: backups, disco y memoria, contenedores caídos, certificados y accesos por SSH."; then
  echo "Discord rechazó el mensaje de prueba: revisá que el webhook exista y no esté borrado." >&2
  exit 1
fi
echo "→ Mensaje de prueba enviado"

chmod +x deploy/vps/*.sh
tmp="$(mktemp)"
{ crontab -l 2>/dev/null || true; } | grep -vF 'deploy/vps/monitor.sh' | grep -vF 'deploy/vps/backup.sh' > "$tmp" || true
echo "*/5 * * * * $BYOX_DIR/deploy/vps/monitor.sh >> $HOME/monitor.log 2>&1" >> "$tmp"
echo "0 7 * * * $BYOX_DIR/deploy/vps/backup.sh >> $HOME/backup.log 2>&1" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
echo "→ Cron: monitor cada 5 min y backup diario (07:00 UTC, 04:00 en Argentina)"

mkdir -p "$HOME/.ssh"
rc="$HOME/.ssh/rc"
touch "$rc"
if ! grep -qF ssh-login-alert "$rc"; then
  printf '%s\n' "[ -x \"$BYOX_DIR/deploy/vps/ssh-login-alert.sh\" ] && ( \"$BYOX_DIR/deploy/vps/ssh-login-alert.sh\" </dev/null >/dev/null 2>&1 & )" >> "$rc"
fi
chmod 600 "$rc"
echo "→ Aviso de inicios de sesión SSH (tu próxima conexión sale como IP nueva: es normal, una sola vez)"
