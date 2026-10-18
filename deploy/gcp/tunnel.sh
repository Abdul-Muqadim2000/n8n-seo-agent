#!/usr/bin/env bash
# tunnel.sh — the n8n editor and its public API on http://localhost:15678, through IAP SSH (no public port; RUNBOOK §4).
#   deploy/gcp/tunnel.sh            keeps running; Ctrl-C closes it. Open http://localhost:15678 in the browser.
#   PORT=5679 deploy/gcp/tunnel.sh  another local port
# With a local Cloud SDK (GCLOUD=gcloud) the forward listens on 127.0.0.1 directly; with the Docker wrapper (the default) it
# listens inside the container and Docker publishes it on 127.0.0.1 only.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
PROJECT=${PROJECT:-alaventra-prod}
ZONE=${ZONE:-me-central1-a}
VM=${VM:-alaventra-vm-1}
PORT=${PORT:-15678}
GCLOUD=${GCLOUD:-$HERE/gcloud-docker.sh gcloud}
read -r -a G <<< "$GCLOUD"
BIND=127.0.0.1
if [[ "${G[0]}" == *gcloud-docker.sh ]]; then export DOCKER_PUBLISH="127.0.0.1:$PORT:$PORT"; BIND=0.0.0.0; fi
echo "n8n editor + API: http://localhost:$PORT  (Ctrl-C to close)"
exec "${G[@]}" compute ssh "$VM" --zone="$ZONE" --project="$PROJECT" --tunnel-through-iap --quiet \
  -- -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L "$BIND:$PORT:127.0.0.1:5678"
