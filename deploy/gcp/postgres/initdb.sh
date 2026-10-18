#!/bin/sh
# First start of the Postgres data directory only (docker-entrypoint-initdb.d): one server, two databases with their own owners.
# n8n and the app never share a role, so neither can read the other's tables. Passwords come from prod.env through compose.
set -eu
: "${N8N_DB_PASSWORD:?}" "${APP_DB_PASSWORD:?}"
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres \
  -v n8n_pw="$N8N_DB_PASSWORD" -v app_pw="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE n8n LOGIN PASSWORD :'n8n_pw';
CREATE ROLE app LOGIN PASSWORD :'app_pw';
CREATE DATABASE n8n OWNER n8n;
CREATE DATABASE app OWNER app;
REVOKE ALL ON DATABASE n8n FROM PUBLIC;
REVOKE ALL ON DATABASE app FROM PUBLIC;
SQL
