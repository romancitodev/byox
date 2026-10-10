#!/usr/bin/env bash
# Avisa a Discord cada vez que alguien entra por SSH. Lo llama ~/.ssh/rc (lo deja puesto install-alerts.sh).
# Una IP que nunca se vio con este usuario sale como advertencia: si no eras vos, es lo primero que querés saber.
# No imprime nada: lo que salga por stdout rompería scp y sftp.
set -uo pipefail

BYOX_DIR="${BYOX_DIR:-$HOME/byox}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$BYOX_DIR/.env" ]; then set -a; . "$BYOX_DIR/.env"; set +a; fi
# shellcheck source=discord.sh
. "$HERE/discord.sh"

ip="${SSH_CONNECTION:-}"
ip="${ip%% *}"
[ -n "$ip" ] || exit 0
known="$HOME/.ssh/known-login-ips"
touch "$known"
if grep -qxF "$ip" "$known"; then
  level=info
  note="conocida"
else
  level=warn
  note="NUEVA"
  echo "$ip" >> "$known"
fi
discord "$level" "Inicio de sesión SSH" "Usuario: $(id -un)"$'\n'"IP: $ip ($note)"$'\n'"Equipo: $(hostname)"
