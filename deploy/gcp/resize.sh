#!/usr/bin/env bash
# resize.sh — one command to move the VM to another machine type, keeping its disks and its address (RUNBOOK §6).
#   deploy/gcp/resize.sh e2-standard-2            dry run: shows the new template and the group update
#   deploy/gcp/resize.sh e2-standard-2 --apply    does it: ~2-4 minutes of downtime while the VM restarts on the new type
#   deploy/gcp/resize.sh e2-medium --apply        and back
# It is bootstrap.sh with MACHINE set: the template name carries a hash of the machine type, so a new template is made, the group
# points at it, and the one VM restarts on it (minimal action RESTART: the stateful boot and data disks and the static IP stay).
# The stack's memory limits (compose.prod.yml) are written for 4 GiB; on 8 GiB they leave the extra memory to the page cache, which
# is what Postgres and n8n's reads want - raise n8n's mem_limit only if you see it near its ceiling (docker stats).
set -euo pipefail
[ $# -ge 1 ] || { sed -n '2,5p' "$0"; exit 2; }
MACHINE=$1; shift
case "$MACHINE" in e2-medium|e2-standard-2|e2-standard-4|e2-highmem-2) ;; *) echo "unexpected machine type: $MACHINE"; exit 2 ;; esac
MACHINE=$MACHINE exec "$(dirname "$0")/bootstrap.sh" "$@"
