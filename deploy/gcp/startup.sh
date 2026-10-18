#!/bin/bash
# VM startup script (instance template metadata `startup-script`). Runs as root on EVERY boot - first boot, reboot, and the
# recreation after a Spot preemption - so every step is idempotent: it checks before it changes anything.
#   1. mounts the data disk (device name "data") on /mnt/data - formats it ONLY when it carries no filesystem at all
#   2. a 4 GiB swap file on the boot disk (vm.swappiness 10: swap is the safety net for a heavy run, not working memory)
#   3. Docker Engine + the compose plugin + git (once), with log rotation as the daemon default
#   4. the three settings files from Secret Manager -> /mnt/data/secrets (0600, root); values are never printed
#   5. the repository at the ref in metadata `alaventra-ref` -> /mnt/data/repo
#   6. the nightly backup timer (backup.sh -> the Cloud Storage bucket)
#   7. docker compose up -d (builds the app image when it is missing)
# Logs: `sudo journalctl -u google-startup-scripts` on the VM.
set -euo pipefail
log() { echo "[alaventra-startup] $*"; }

MD=http://metadata.google.internal/computeMetadata/v1
md() { curl -fsS -H 'Metadata-Flavor: Google' "$MD/$1" 2>/dev/null || true; }
PROJECT=$(md project/project-id)
NAME=$(md instance/attributes/alaventra-name); NAME=${NAME:-ascentra}
REPO=$(md instance/attributes/alaventra-repo); REPO=${REPO:-https://github.com/Abdul-Muqadim2000/n8n-seo-agent.git}
REF=$(md instance/attributes/alaventra-ref); REF=${REF:-main}
DATA=/mnt/data
SECRETS=$DATA/secrets

# ---- 1. data disk --------------------------------------------------------------------------------------------------------
DEV=/dev/disk/by-id/google-data
for _ in $(seq 1 30); do [ -e "$DEV" ] && break; sleep 2; done
[ -e "$DEV" ] || { log "data disk $DEV not attached - refusing to start the stack without its state"; exit 1; }
if ! blkid "$DEV" >/dev/null 2>&1; then
  log "data disk has no filesystem: formatting it (first boot only)"
  mkfs.ext4 -m 0 -E lazy_itable_init=0,lazy_journal_init=0,discard -L alaventra-data "$DEV"
fi
mkdir -p "$DATA"
grep -q "LABEL=alaventra-data" /etc/fstab || echo "LABEL=alaventra-data $DATA ext4 discard,defaults,nofail,noatime 0 2" >> /etc/fstab
mountpoint -q "$DATA" || mount "$DATA"
resize2fs "$DEV" >/dev/null 2>&1 || true   # after `gcloud compute disks resize` the filesystem follows on the next boot

# ---- 2. swap -------------------------------------------------------------------------------------------------------------
if [ ! -f /swapfile ]; then
  log "creating the 4 GiB swap file"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null
fi
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
swapon --show=NAME --noheadings | grep -q '^/swapfile$' || swapon /swapfile
cat > /etc/sysctl.d/90-alaventra.conf <<'EOF'
vm.swappiness = 10
vm.vfs_cache_pressure = 50
EOF
sysctl -q --system || true

# ---- 3. Docker -----------------------------------------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  log "installing Docker Engine + compose plugin + git"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
command -v git >/dev/null 2>&1 || apt-get install -y -qq git
mkdir -p /etc/docker
DJ='{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"},"live-restore":true}'
if [ "$(cat /etc/docker/daemon.json 2>/dev/null)" != "$DJ" ]; then echo "$DJ" > /etc/docker/daemon.json; systemctl restart docker; fi
systemctl enable --now docker >/dev/null

# ---- 4. settings from Secret Manager (REST + the VM's own token: no extra tools; values never reach the log) -------------
umask 077
mkdir -p "$SECRETS"
TOKEN=$(md instance/service-accounts/default/token | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
fetch_secret() {  # $1 secret id, $2 target file
  local tmp; tmp=$(mktemp)
  if curl -fsS -H "Authorization: Bearer $TOKEN" \
      "https://secretmanager.googleapis.com/v1/projects/$PROJECT/secrets/$1/versions/latest:access" -o "$tmp"; then
    python3 -c 'import sys,json,base64; sys.stdout.buffer.write(base64.b64decode(json.load(open(sys.argv[1]))["payload"]["data"]))' "$tmp" > "$2.new"
    mv "$2.new" "$2"; chmod 600 "$2"; log "secret $1 -> $2"
  else
    log "secret $1 could not be read (load_secrets.sh not run yet?)"; rm -f "$tmp"; return 1
  fi
  rm -f "$tmp"
}
fetch_secret "$NAME-prod-env" "$SECRETS/prod.env"
fetch_secret "$NAME-n8n-env" "$SECRETS/n8n.env"
fetch_secret "$NAME-app-env" "$SECRETS/app.env"
umask 022

# ---- 5. the repository --------------------------------------------------------------------------------------------------
git config --global --add safe.directory "$DATA/repo" 2>/dev/null || true
if [ ! -d "$DATA/repo/.git" ]; then
  log "cloning $REPO"
  git clone --quiet "$REPO" "$DATA/repo"
fi
git -C "$DATA/repo" fetch --quiet origin "$REF"
git -C "$DATA/repo" checkout --quiet --force FETCH_HEAD
log "repository at $(git -C "$DATA/repo" rev-parse --short HEAD) ($REF)"

# ---- data directories (n8n and the app run as uid 1000 inside their images) ----------------------------------------------
mkdir -p "$DATA/postgres" "$DATA/n8n" "$DATA/caddy/data" "$DATA/caddy/config" "$DATA/spool" "$DATA/backups"
chown 1000:1000 "$DATA/n8n" "$DATA/spool"

# ---- 6. nightly backup --------------------------------------------------------------------------------------------------
cat > /etc/systemd/system/alaventra-backup.service <<EOF
[Unit]
Description=Alaventra nightly pg_dump to Cloud Storage
After=docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash $DATA/repo/deploy/gcp/backup.sh
EOF
cat > /etc/systemd/system/alaventra-backup.timer <<'EOF'
[Unit]
Description=Alaventra nightly backup
[Timer]
OnCalendar=*-*-* 01:30:00 UTC
Persistent=true
RandomizedDelaySec=300
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now alaventra-backup.timer >/dev/null

# ---- 7. the stack -------------------------------------------------------------------------------------------------------
cd "$DATA/repo/deploy/gcp"
export DATA_DIR=$DATA SECRETS_DIR=$SECRETS
COMPOSE=(docker compose -p alaventra --env-file "$SECRETS/prod.env" -f compose.prod.yml)
TAG=$(grep -E '^APP_IMAGE_TAG=' "$SECRETS/prod.env" | cut -d= -f2- || true)
if ! docker image inspect "alaventra-app:${TAG:-local}" >/dev/null 2>&1; then
  log "building the app image (first boot: a few minutes)"
  "${COMPOSE[@]}" build app
fi
"${COMPOSE[@]}" up -d --remove-orphans
log "stack up: $("${COMPOSE[@]}" ps --format '{{.Service}}={{.State}}' | tr '\n' ' ')"
