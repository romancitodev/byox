#!/usr/bin/env bash
# Copia diaria de byox en una VPS con docker-compose.cloud.yml. Guarda en $BACKUP_DIR:
#   postgres.sql.gz     Forgejo (cuentas, issues) y el estado del MCP
#   forgejo-data.tgz    repositorios, LFS, adjuntos
#   mcp-data.tgz        resultados de los tests por etapa
#   config.tgz          .env y data/runner (credenciales: guardala cifrada fuera del servidor)
#
# Frena Forgejo y el MCP unos segundos para que base y archivos queden del mismo instante.
# Cron (como el usuario deploy; 07:00 UTC = 04:00 en Argentina):
#   0 7 * * * /home/deploy/byox/deploy/vps/backup.sh >> /home/deploy/backup.log 2>&1
#
# Si BACKUP_RCLONE_REMOTE está definido (ej. "b2:byox-backups") y hay rclone, sube la copia ahí.
# Una copia que sólo vive en el mismo servidor no es una copia.
set -euo pipefail

BYOX_DIR="${BYOX_DIR:-$HOME/byox}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
cd "$BYOX_DIR"
[ -f .env ] && set -a && . ./.env && set +a

dest="$BACKUP_DIR/$(date +%F)"
mkdir -p "$dest"
umask 077

restart() { docker compose start forgejo mcp >/dev/null; }
docker compose stop forgejo mcp >/dev/null
trap restart EXIT

docker compose exec -T postgres pg_dumpall -U postgres | gzip > "$dest/postgres.sql.gz"
docker run --rm -v byox_forgejo-data:/d -v "$dest":/b alpine tar czf /b/forgejo-data.tgz -C /d .
docker run --rm -v byox_mcp-data:/d -v "$dest":/b alpine tar czf /b/mcp-data.tgz -C /d .
tar czf "$dest/config.tgz" .env data/runner

restart
trap - EXIT

# Un pg_dumpall vacío o truncado no sirve: falla en voz alta.
[ "$(gzip -dc "$dest/postgres.sql.gz" | wc -c)" -gt 1000 ] || { echo "postgres.sql.gz sospechosamente chico" >&2; exit 1; }

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$dest" "$BACKUP_RCLONE_REMOTE/$(basename "$dest")"
fi
echo "$(date -Is) ok → $dest"
