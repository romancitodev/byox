#!/usr/bin/env bash
# Pruebas de los scripts de avisos, sin red ni Discord (curl y discord van falsos).
#   bash deploy/vps/test.sh
# Necesita bash y node (para comprobar que el JSON es válido). En Windows, dentro de Docker:
#   docker run --rm -v "$PWD:/w" -w /w node:22-bookworm bash deploy/vps/test.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fails=0
ok() { echo "  ok   $1"; }
bad() { echo "  FAIL $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Lee un JSON de stdin y evalúa una expresión sobre `j`; sale 0 si da true.
js() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.exit(eval(process.argv[1])?0:1)})' "$1"; }

echo "discord.sh"
. "$HERE/discord.sh"
export BYOX_INSTANCE_NAME="app.byox.dev"

nasty=$'comilla " barra \\ tab\t línea 2\nñandú 🔥 \x01\x1b[31mrojo @everyone <@123456789012345678>'
p="$(discord_payload warn 'Título "raro"' "$nasty")"
check "el JSON es válido con comillas, barras, saltos, tabs, controles y emoji" "printf '%s' \"\$p\" | js 'j.embeds[0].title.includes(\"raro\")'"
check "las menciones quedan apagadas" "printf '%s' \"\$p\" | js 'j.allowed_mentions.parse.length===0 && j.allowed_mentions.users.length===0 && j.content===undefined'"
check "los controles se eliminan y el texto se conserva" "printf '%s' \"\$p\" | js '!/[\\x00-\\x08\\x0b-\\x1f]/.test(j.embeds[0].description) && j.embeds[0].description.includes(\"ñandú 🔥\")'"
check "los saltos de línea se conservan" "printf '%s' \"\$p\" | js 'j.embeds[0].description.includes(\"\\n\")'"
long="$(head -c 6000 /dev/zero | tr '\0' 'é')"
p="$(LC_ALL=C discord_payload error T "$long")"
check "un texto largo se recorta y sigue siendo JSON/UTF-8 válido" "printf '%s' \"\$p\" | js 'j.embeds[0].description.length<=1500 && !j.embeds[0].description.includes(\"\\ufffd\")'"
check "el pie lleva instancia y equipo" "printf '%s' \"\$p\" | js 'j.embeds[0].footer.text.startsWith(\"app.byox.dev · \")'"

p="$(DISCORD_PING_USER=123456789012345678 discord_payload error Mal)"
check "un error menciona sólo al usuario configurado" "printf '%s' \"\$p\" | js 'j.content===\"<@123456789012345678>\" && j.allowed_mentions.users[0]===\"123456789012345678\"'"
p="$(DISCORD_PING_USER=123456789012345678 discord_payload info Bien)"
check "un info no menciona a nadie" "printf '%s' \"\$p\" | js 'j.content===undefined'"
p="$(DISCORD_PING_USER='@everyone' discord_payload error Mal)"
check "un DISCORD_PING_USER que no es un ID se ignora" "printf '%s' \"\$p\" | js 'j.content===undefined'"
check "el color cambia por nivel" "discord_payload info a | js 'j.embeds[0].color===3908957' && discord_payload warn a | js 'j.embeds[0].color===16426522' && discord_payload error a | js 'j.embeds[0].color===15548997'"

for good in https://discord.com/api/webhooks/123456789012345678/abc_DEF-1 https://canary.discord.com/api/webhooks/1234567890/x https://discordapp.com/api/webhooks/1234567890/x; do
  check "acepta $good" "DISCORD_WEBHOOK_URL=$good discord_valid"
done
for bad_url in "" http://discord.com/api/webhooks/1/x https://discord.com.evil.io/api/webhooks/1/x https://evil.io/api/webhooks/123/x "https://discord.com/api/webhooks/123/x?y=1" "https://discord.com/api/webhooks/abc/x"; do
  check "rechaza '$bad_url'" "! DISCORD_WEBHOOK_URL='$bad_url' discord_valid"
done

calls=0
curl() { calls=$((calls + 1)); return 0; }
DISCORD_WEBHOOK_URL="" discord info x; rc=$?
check "sin webhook no llama a curl y no falla" "[ \$rc -eq 0 ] && [ \$calls -eq 0 ]"
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789012345678/abc discord info x
check "con webhook llama a curl una vez" "[ \$calls -eq 1 ]"
curl() { return 22; }
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789012345678/abc discord info x; rc=$?
check "si curl falla, discord no falla" "[ \$rc -eq 0 ]"
unset -f curl

echo "monitor.sh"
. "$HERE/monitor.sh"
STATE_DIR="$(mktemp -d)"
sent=()
discord() { sent+=("$1|$2"); }
step() { MONITOR_NOW="$1"; shift; report "$@"; }

step 1000 Disco error bad "lleno"
check "una sola revisión mala no avisa" "[ \${#sent[@]} -eq 0 ]"
step 1300 Disco error bad "lleno"
check "la segunda revisión mala avisa" "[ \"\${sent[0]}\" = 'error|Disco: con problemas' ]"
step 1600 Disco error bad "lleno"
step 5000 Disco error bad "lleno"
check "no repite antes de 6 h" "[ \${#sent[@]} -eq 1 ]"
step 23000 Disco error bad "lleno"
check "recuerda pasadas 6 h" "[ \${#sent[@]} -eq 2 ]"
step 23300 Disco error ok
check "avisa cuando se recupera" "[ \"\${sent[2]}\" = 'info|Disco: recuperado' ]"
step 23600 Disco error ok
check "después de recuperado no avisa más" "[ \${#sent[@]} -eq 3 ]"
step 24000 Memoria warn bad "poca"
step 24300 Memoria warn ok
check "un parpadeo (mal y bien) no avisa nada" "[ \${#sent[@]} -eq 3 ]"
step 24600 "Reinicio pendiente" warn bad "reboot"
step 24900 "Reinicio pendiente" warn bad "reboot"
check "usa el nivel que se le pide" "[ \"\${sent[3]}\" = 'warn|Reinicio pendiente: con problemas' ]"

echo "sintaxis"
for f in "$HERE"/*.sh; do check "bash -n $(basename "$f")" "bash -n '$f'"; done

echo
if [ "$fails" -eq 0 ]; then echo "todo bien"; else echo "$fails fallo(s)"; exit 1; fi
