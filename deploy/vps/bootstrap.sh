#!/usr/bin/env bash
# Prepara una VPS nueva (Ubuntu 24.04/26.04 o Debian 12) para byox: usuario sin root, SSH sólo con llave,
# firewall, Docker, Caddy, swap y limpieza semanal. Correr UNA vez como root:
#
#   scp bootstrap.sh <usuario>@<ip>:        # root, o ubuntu/debian si es OVH
#   sudo bash bootstrap.sh
#
# Se puede repetir: lo que ya está hecho se saltea. No clona byox ni levanta nada: eso sigue en README.md.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_GB="${SWAP_GB:-4}"

[ "$(id -u)" -eq 0 ] || { echo "Correlo como root." >&2; exit 1; }
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo "Sólo Ubuntu o Debian (esto es $ID)." >&2; exit 1 ;; esac
export DEBIAN_FRONTEND=noninteractive

# Un intento anterior pudo dejar roto el repo de Caddy y apt-get update fallaría ya acá: se vuelve a decidir más abajo.
command -v caddy >/dev/null 2>&1 || rm -f /etc/apt/sources.list.d/caddy-stable.list

echo "→ Paquetes base"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades cron

echo "→ Usuario $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"
# sudo sin contraseña: el usuario no tiene ninguna y entra sólo con llave.
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"
# Las llaves que ya servían para root, o para el usuario con el que entraste (OVH trae `ubuntu` o `debian`
# con sudo y sin root), pasan al usuario nuevo.
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
for src in /root/.ssh/authorized_keys "$(getent passwd "${SUDO_USER:-root}" | cut -d: -f6)/.ssh/authorized_keys"; do
  [ -s "$src" ] && cat "$src" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
done
if [ -f "/home/$DEPLOY_USER/.ssh/authorized_keys" ]; then
  sort -u -o "/home/$DEPLOY_USER/.ssh/authorized_keys" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
if [ ! -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]; then
  echo "No hay ninguna llave SSH para $DEPLOY_USER (ni en /root/.ssh/authorized_keys)." >&2
  echo "Agregala en /home/$DEPLOY_USER/.ssh/authorized_keys y volvé a correr: si no, quedarías afuera." >&2
  exit 1
fi

echo "→ SSH: sin contraseña y sin root"
# 00-: el primer valor que lee sshd gana, y algunas imágenes traen un 50-cloud-init.conf con PasswordAuthentication yes.
cat > /etc/ssh/sshd_config.d/00-byox.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t
# En Ubuntu 24.04 sshd arranca por socket y ssh.service puede estar inactivo: no hay nada que recargar y cada
# conexión nueva ya lee la configuración nueva. Que eso no corte el script.
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

echo "→ Firewall (22, 80, 443)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

echo "→ Actualizaciones de seguridad automáticas"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "→ Swap de ${SWAP_GB} GB"
if ! swapon --show | grep -q .; then
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-byox.conf
sysctl -q -p /etc/sysctl.d/99-byox.conf

echo "→ Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  if apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
    :
  else
    # Una versión recién salida puede no tener todavía repo en Docker: se usa el de la distribución.
    echo "  (sin repo de Docker para $VERSION_CODENAME: instalo docker.io de $ID)"
    rm -f /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker.io docker-compose-v2
  fi
fi
# Los logs de los contenedores crecen sin límite por defecto y llenan el disco.
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
  systemctl restart docker
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

echo "→ Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  # Repo oficial (Cloudsmith); si falla (a veces responde 402 por cuota), se usa el paquete de la distribución.
  if curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update -y \
    && apt-get install -y caddy; then
    :
  else
    echo "  (repo oficial de Caddy no disponible: instalo el de $ID)"
    rm -f /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  fi
fi

echo "→ Limpieza semanal de imágenes de Docker (no toca volúmenes: las cachés de los cursos se quedan)"
cat > /etc/cron.d/byox-prune <<'EOF'
0 5 * * 0 root docker image prune -af --filter "until=168h" >/dev/null 2>&1; docker builder prune -af --filter "until=168h" >/dev/null 2>&1
EOF

cat <<EOF

Listo. Desde tu equipo, comprobá que entrás con el usuario nuevo ANTES de cerrar esta sesión:
  ssh $DEPLOY_USER@<ip>
Seguí con README.md (clonar byox, .env, setup.sh, Caddyfile).
EOF
