#!/bin/bash
# restore.sh — puts a nightly backup (backup.sh) back into the running stack. On the VM, as root (RUNBOOK §5):
#
#   sudo bash /mnt/data/repo/deploy/gcp/restore.sh --list                      the backups in the bucket, newest first
#   sudo bash restore.sh 2026-10-19 --yes                                      both databases from that night (newest dump of the day)
#   sudo bash restore.sh 2026-10-19 --only app --yes                           one database (n8n | app)
#   sudo bash restore.sh /mnt/data/backups/app-2026-10-19T013000Z.dump --yes   a dump file already on the disk
#
# What it does, per database: fetches the dump (Cloud Storage JSON API with the VM's own token) -> stops the services that use it
# (app; or n8n + runners) -> drops and recreates the database owned by its role -> pg_restore --no-owner --role=<role> -> starts the
# services -> prints the table count and row total. Without --yes it only says what it would do. Everything else (Caddy, the other
# database, the disk) is left alone. For the whole disk, use a snapshot instead (RUNBOOK §5).
set -euo pipefail
cd "$(dirname "$0")"
DATA=${DATA_DIR:-/mnt/data}
SECRETS=${SECRETS_DIR:-$DATA/secrets}
read -r -a COMPOSE <<< "${ALAVENTRA_COMPOSE:-docker compose -p alaventra --env-file $SECRETS/prod.env -f compose.prod.yml}"
BUCKET=$(grep -E '^BACKUP_BUCKET=' "$SECRETS/prod.env" 2>/dev/null | cut -d= -f2- || true)
WHAT='' ONLY='' YES=0 LIST=0
while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY=$2; shift ;;
    --yes) YES=1 ;;
    --list) LIST=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) WHAT=$1 ;;
  esac
  shift
done

token() {
  curl -fsS -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])'
}
objects() {  # $1 prefix -> object names, newest first
  curl -fsS -H "Authorization: Bearer $(token)" "https://storage.googleapis.com/storage/v1/b/$BUCKET/o?prefix=$1&fields=items(name,updated)" \
    | python3 -c 'import sys,json; it=json.load(sys.stdin).get("items",[]); [print(i["name"]) for i in sorted(it,key=lambda i:i["updated"],reverse=True)]'
}

if [ "$LIST" = 1 ]; then [ -n "$BUCKET" ] || { echo "no BACKUP_BUCKET in prod.env"; exit 1; }; objects pg/; exit 0; fi
[ -n "$WHAT" ] || { echo "which backup? a date (YYYY-MM-DD), a .dump file, or --list"; exit 2; }


# parallel lists (no associative arrays: the script also runs under the bash 3.2 of a Mac for the local rehearsal)
DBS=() FILES=()
mkdir -p "$DATA/backups/restore"
for db in n8n app; do
  [ -n "$ONLY" ] && [ "$ONLY" != "$db" ] && continue
  if [ -f "$WHAT" ]; then
    case "$(basename "$WHAT")" in "$db"-*) DBS+=("$db"); FILES+=("$WHAT") ;; *) continue ;; esac
  else
    [ -n "$BUCKET" ] || { echo "no BACKUP_BUCKET in prod.env"; exit 1; }
    obj=$(objects "pg/$WHAT/$db-" | head -1)
    [ -n "$obj" ] || { echo "no $db backup under gs://$BUCKET/pg/$WHAT/"; exit 1; }
    f=$DATA/backups/restore/$(basename "$obj")
    DBS+=("$db"); FILES+=("$f")
    echo "$db: gs://$BUCKET/$obj"
    if [ "$YES" = 1 ]; then
      curl -fsS -H "Authorization: Bearer $(token)" -o "$f" \
        "https://storage.googleapis.com/storage/v1/b/$BUCKET/o/$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$obj")?alt=media"
    fi
  fi
done
[ "${#DBS[@]}" -gt 0 ] || { echo "nothing to restore for '$WHAT'${ONLY:+ (--only $ONLY)}"; exit 1; }

COUNT_SQL="SELECT count(*) || ' tables, ' || COALESCE(sum(n_live_tup),0) || ' rows (estimate)' FROM pg_stat_user_tables;"
for i in "${!DBS[@]}"; do
  db=${DBS[$i]} f=${FILES[$i]}
  svc=(app); [ "$db" = n8n ] && svc=(n8n runners)
  echo "== $db from $f: stop ${svc[*]}, recreate database $db (owner $db), pg_restore, start ${svc[*]}"
  [ "$YES" = 1 ] || continue
  "${COMPOSE[@]}" stop "${svc[@]}" </dev/null
  "${COMPOSE[@]}" exec -T postgres psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" -c "CREATE DATABASE $db OWNER $db" </dev/null
  "${COMPOSE[@]}" exec -T postgres pg_restore -U postgres -d "$db" --no-owner --no-acl --role="$db" --exit-on-error < "$f"
  "${COMPOSE[@]}" exec -T postgres psql -U postgres -d "$db" -Atq -c "ANALYZE" -c "$COUNT_SQL" </dev/null
  "${COMPOSE[@]}" up -d "${svc[@]}" </dev/null
done
[ "$YES" = 1 ] || echo "(nothing changed: add --yes)"
