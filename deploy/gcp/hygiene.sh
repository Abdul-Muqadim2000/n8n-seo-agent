#!/bin/bash
# Daily boot-disk hygiene + disk alarm (systemd timer alaventra-hygiene.timer, 03:15 UTC; safe to run by hand: `sudo bash hygiene.sh`).
#
# Why (2026-11-12): the 20 GB boot disk reached 99% (281 MB free) with nothing alerting. What filled it:
#   - gotenberg's container /tmp: ~2 GB of per-request working dirs (UUID names) that Chromium restarts / timeouts leave behind;
#   - ~2.7 GB of docker build cache from app rebuilds on the VM, and one ~540 MB rollback image per API deploy;
#   - ~700 MB of systemd journal.
# Every step below only removes things nothing can still be using; the alarm posts to the ops webhook (SEO_ALERT_WEBHOOK_URL in the
# engine settings) when the boot disk or the data disk is at or above ALARM_PCT, or when the nightly backup did not complete, so a
# full disk or a missing backup is never found by accident again.
#
#   sudo bash hygiene.sh            clean + check
#   sudo bash hygiene.sh --check    check only (no cleaning)
#   sudo bash hygiene.sh --install  copy itself to /usr/local/sbin, write the journald cap and the timer (idempotent; startup.sh calls it)
set -uo pipefail
DATA=${DATA_DIR:-/mnt/data}
SECRETS=${SECRETS_DIR:-$DATA/secrets}
ALARM_PCT=${ALARM_PCT:-85}
KEEP_ROLLBACK=${KEEP_ROLLBACK:-3}
log() { echo "[alaventra-hygiene] $*"; }

if [ "${1:-}" = "--install" ]; then
  install -m 0755 "$0" /usr/local/sbin/alaventra-hygiene.sh
  mkdir -p /etc/systemd/journald.conf.d
  JC=$'[Journal]\nSystemMaxUse=300M\n'
  if [ "$(cat /etc/systemd/journald.conf.d/alaventra.conf 2>/dev/null)" != "$(printf '%s' "$JC")" ]; then
    printf '%s' "$JC" > /etc/systemd/journald.conf.d/alaventra.conf
    systemctl restart systemd-journald || true
  fi
  cat > /etc/systemd/system/alaventra-hygiene.service <<EOF
[Unit]
Description=Alaventra boot-disk hygiene and disk alarm
After=docker.service
[Service]
Type=oneshot
Environment=DATA_DIR=$DATA SECRETS_DIR=$SECRETS
ExecStart=/bin/bash /usr/local/sbin/alaventra-hygiene.sh
EOF
  cat > /etc/systemd/system/alaventra-hygiene.timer <<'EOF'
[Unit]
Description=Alaventra daily disk hygiene
[Timer]
OnCalendar=*-*-* 03:15:00 UTC
Persistent=true
RandomizedDelaySec=300
[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now alaventra-hygiene.timer >/dev/null
  log "installed (timer $(systemctl is-enabled alaventra-hygiene.timer))"
  exit 0
fi

pct() { df --output=pcent "$1" 2>/dev/null | tail -1 | tr -dc '0-9'; }
free_h() { df -h --output=avail "$1" 2>/dev/null | tail -1 | tr -d ' '; }

if [ "${1:-}" != "--check" ]; then
  before=$(pct /)
  # 1. gotenberg: per-request working dirs (UUID names) older than 2 hours. A conversion times out at 120 s, so nothing that old is in use.
  GOT=$(docker ps --filter 'label=com.docker.compose.service=gotenberg' --format '{{.Names}}' | head -1)
  if [ -n "$GOT" ]; then
    docker exec -u 0 "$GOT" sh -c "find /tmp -mindepth 1 -maxdepth 1 -type d -mmin +120 \
      -name '????????-????-????-????-????????????' -exec rm -rf {} +" \
      && log "gotenberg: stale request dirs removed" || log "gotenberg: cleanup failed (container busy or gone)"
  fi
  # 2. docker build cache older than 3 days (an app rebuild on the VM leaves ~0.5-1 GB each time).
  docker builder prune -f --filter 'until=72h' >/dev/null 2>&1 && log "build cache older than 3 days pruned"
  # 3. app rollback images: keep the newest $KEEP_ROLLBACK (deploys tag the previous image alaventra-app:rollback-<commit>).
  docker images --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' 'alaventra-app' | grep ':rollback-' | sort -r \
    | tail -n +$((KEEP_ROLLBACK + 1)) | cut -d'|' -f2 | while read -r img; do
      docker rmi "$img" >/dev/null 2>&1 && log "removed old rollback image $img"
    done
  # 4. dangling images (the previous :local after a rebuild).
  docker image prune -f >/dev/null 2>&1
  # 5. journal (journald.conf.d caps it at 300 MB; this catches the window before a restart applied the cap).
  journalctl --vacuum-size=300M >/dev/null 2>&1
  log "boot disk ${before}% -> $(pct /)% ($(free_h /) free)"
fi

# Alarm: boot disk and data disk; and the nightly backup (backup.sh keeps the last two complete dumps on the data disk).
msg=""
find "$DATA/backups" -maxdepth 1 -name '*.dump.part' -mmin +240 -delete 2>/dev/null
if [ -d "$DATA/backups" ] && [ -z "$(find "$DATA/backups" -maxdepth 1 -name 'app-*.dump' -mmin -1800 2>/dev/null | head -1)" ]; then
  msg="$msg no complete nightly backup in the last 30 hours (journalctl -u alaventra-backup);"
fi
for m in / "$DATA"; do
  p=$(pct "$m"); [ -n "$p" ] || continue
  if [ "$p" -ge "$ALARM_PCT" ]; then msg="$msg $m at ${p}% ($(free_h "$m") free);"; fi
done
if [ -n "$msg" ]; then
  log "ALARM:$msg"
  HOOK=$(grep -E '^SEO_ALERT_WEBHOOK_URL=' "$SECRETS/n8n.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'" || true)
  if [ -n "$HOOK" ]; then
    text="Alaventra production alarm on $(hostname):$msg check with: sudo docker system df; sudo du -xh --max-depth=2 / | sort -rh | head"
    curl -fsS -m 20 -X POST -H 'Content-Type: application/json' \
      --data "$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "$text")" "$HOOK" >/dev/null \
      && log "alarm posted to the ops webhook" || log "alarm could not be posted"
  else
    log "no ops webhook configured: alarm only in this log"
  fi
  exit 2
fi
exit 0
