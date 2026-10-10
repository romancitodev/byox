# byox en una VPS (byox.dev)

Una sola máquina con todo: Forgejo, Postgres, MCP/web y el runner, con Caddy delante para HTTPS.
Pensado para 4 vCPU / 8 GB. La separación en dos VPS (A núcleo, B runners) viene después y se simula en `../k8s-sim`.

| Nombre | A dónde va |
|---|---|
| `byox.dev` | Landing (Vercel). No se toca en este deploy. |
| `app.byox.dev` | La app y el MCP (puerto 3333 local) |
| `git.byox.dev` | Forgejo (puerto 3000 local) |

## 1. DNS (cuando tengas la IP)

Registros `A` hacia la IP de la VPS, con TTL bajo (300) para corregir rápido:

```text
app.byox.dev   A   <ip>
git.byox.dev   A   <ip>
```

Si la VPS tiene IPv6, sumá los `AAAA`. Esperá a que resuelvan (`dig +short app.byox.dev`) antes de iniciar Caddy: sin eso no puede sacar los certificados.

## 2. Preparar la máquina

Entrá con la llave que cargaste al comprarla. El usuario inicial depende del proveedor: `root` en Hetzner, `ubuntu` o `debian` (con sudo) en OVH. Copiá `bootstrap.sh` y corré:

```bash
scp deploy/vps/bootstrap.sh <usuario>@<ip>:
ssh <usuario>@<ip> sudo bash bootstrap.sh
```

Si OVH te mandó una contraseña en vez de cargar una llave, primero subí la tuya con `ssh-copy-id <usuario>@<ip>`: el script se niega a seguir sin ninguna llave.

Crea el usuario `deploy` (con tus llaves), desactiva contraseña y root por SSH, abre sólo 22/80/443, instala Docker y Caddy, pone 4 GB de swap, rotación de logs y limpieza semanal de imágenes.
**Antes de cerrar la sesión de root, abrí otra terminal y comprobá `ssh deploy@<ip>`.**

## 3. Instalar byox

Como `deploy`:

```bash
git clone <repo> byox && cd byox
cp deploy/vps/.env.example .env
./setup.sh
```

`setup.sh` lee el `.env`, genera las contraseñas de Postgres, crea tu usuario admin, el bot, los tokens y el runner, y levanta todo. Tu contraseña de admin queda en `.env` (`BYOX_PASSWORD`): guardala en un gestor y cambiala desde la app.

## 4. HTTPS

```bash
sudo cp deploy/vps/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Probá `https://app.byox.dev/health` (debe responder `ok`) y entrá a `https://app.byox.dev/app`.

## 5. Antes de dar acceso a otras personas

- [ ] Probar un curso completo: empezar, push, ver el resultado de los tests en la app.
- [ ] Revisar `docker stats` y `free -m` con un par de jobs en paralelo; ajustar `capacity` en `data/runner/config.yml` (2 por defecto) y `docker compose restart runner`.
- [ ] Backups: `crontab -e` con la línea de `backup.sh`, y **probar restaurar** (pasos en la guía `/docs/produccion`, versión con Postgres abajo).
- [ ] Copia fuera de la VPS (rclone a B2/S3/Storage Box con `BACKUP_RCLONE_REMOTE`).
- [ ] Un monitor externo (UptimeRobot, Better Stack) sobre `https://app.byox.dev/health`.
- [ ] `BYOX_SIGNUP=invite` en `.env` y `docker compose up -d` cuando quieras sumar gente.

## Restaurar una copia (con Postgres)

En una máquina ya preparada, con el repo clonado, desde `~/byox`:

```bash
d=~/backups/<fecha>
docker compose down
tar xzf $d/config.tgz
docker compose up -d postgres
gzip -dc $d/postgres.sql.gz | docker compose exec -T postgres psql -U postgres
docker run --rm -v byox_forgejo-data:/d -v $d:/b alpine sh -c "cd /d && tar xzf /b/forgejo-data.tgz"
docker run --rm -v byox_mcp-data:/d -v $d:/b alpine sh -c "cd /d && tar xzf /b/mcp-data.tgz"
docker compose up -d
```

El `pg_dumpall` crea los roles y bases; si el volumen de Postgres ya tenía los de `init-db.sh`, vas a ver errores de "already exists": se pueden ignorar, o bajá el volumen antes (`docker compose down -v` borra TODO, incluido lo que quieras conservar: sólo en una máquina vacía).

## Qué NO cubre esto

- **Multi-inquilino no confiable.** El runner usa el socket de Docker del host (root efectivo) y el bot `byox` es colaborador de todos los repos. Con `BYOX_SIGNUP=closed` o `invite` entre gente de confianza está bien; con registro abierto necesitás sandbox real y tokens por repo.
- **Límites del plan** (minutos de runner, llamadas MCP): hoy sólo se mide el uso de MCP, no se aplica nada.
- **Alta disponibilidad.** Una VPS es un punto único de falla: la defensa son los backups.
