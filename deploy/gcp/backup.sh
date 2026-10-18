#!/bin/bash
# Nightly logical backup (systemd timer alaventra-backup.timer, 01:30 UTC; also safe to run by hand: `sudo bash backup.sh`).
# pg_dump of both databases in custom format (compressed, restorable table by table with pg_restore) -> /mnt/data/backups ->
# gs://<bucket>/pg/<date>/ . The bucket keeps 14 days (lifecycle) with versioning; the disk snapshots (7 days) are the second layer.
# Uploads use the VM's own token through the Cloud Storage JSON API: no gcloud needed on the VM.
set -euo pipefail
DATA=${DATA_DIR:-/mnt/data}
SECRETS=${SECRETS_DIR:-$DATA/secrets}
OUT=$DATA/backups
cd "$(dirname "$0")"
BUCKET=$(grep -E '^BACKUP_BUCKET=' "$SECRETS/prod.env" | cut -d= -f2- || true)
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
COMPOSE=(docker compose -p alaventra --env-file "$SECRETS/prod.env" -f compose.prod.yml)
mkdir -p "$OUT"
for db in n8n app; do
  f="$OUT/$db-$STAMP.dump"
  "${COMPOSE[@]}" exec -T postgres pg_dump -U postgres -Fc -Z 6 "$db" > "$f.part"
  mv "$f.part" "$f"
  echo "dumped $db: $(du -h "$f" | cut -f1)"
done
if [ -n "$BUCKET" ]; then
  TOKEN=$(curl -fsS -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
  for f in "$OUT"/*-"$STAMP".dump; do
    name="pg/${STAMP:0:10}/$(basename "$f")"
    curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/octet-stream' --data-binary @"$f" \
      "https://storage.googleapis.com/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=$name" >/dev/null
    echo "uploaded gs://$BUCKET/$name"
  done
else
  echo "BACKUP_BUCKET not set in prod.env: kept on the data disk only"
fi
# keep two nights on the disk (the bucket holds the rest)
ls -1t "$OUT"/n8n-*.dump 2>/dev/null | tail -n +3 | xargs -r rm -f
ls -1t "$OUT"/app-*.dump 2>/dev/null | tail -n +3 | xargs -r rm -f
