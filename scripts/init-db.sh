#!/bin/sh
# Lo corre la imagen de Postgres una sola vez, al crear el volumen (ver docker-compose.cloud.yml).
# Una base y un usuario por servicio, para que el MCP no pueda leer la de Forgejo ni al revés.
set -e

psql -v ON_ERROR_STOP=1 -v fpw="$FORGEJO_DB_PASSWORD" -v bpw="$BYOX_DB_PASSWORD" \
  --username "$POSTGRES_USER" --dbname postgres <<'SQL'
CREATE ROLE forgejo LOGIN PASSWORD :'fpw';
CREATE ROLE byox LOGIN PASSWORD :'bpw';
CREATE DATABASE forgejo OWNER forgejo ENCODING 'UTF8';
CREATE DATABASE byox OWNER byox ENCODING 'UTF8';
REVOKE ALL ON DATABASE forgejo FROM PUBLIC;
REVOKE ALL ON DATABASE byox FROM PUBLIC;
SQL
