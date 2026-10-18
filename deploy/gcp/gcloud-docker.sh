#!/bin/sh
# gcloud in Docker for a machine without the Cloud SDK: GCLOUD="deploy/gcp/gcloud-docker.sh gcloud" deploy/gcp/bootstrap.sh
# Mounts your gcloud login, this repository and the temp directories at the SAME paths, so the files the scripts hand to gcloud
# (startup script, lifecycle and policy JSON, secret payloads) resolve inside the container exactly as outside.
# Pass-through stdin (-i) so `--data-file=-` and `ssh --command` input work; no TTY so output can be captured.
#   DOCKER_PUBLISH=127.0.0.1:15678:15678   publish a port (tunnel.sh: the SSH port-forward listens inside the container)
# The SSH key gcloud makes for OS Login is kept in ~/.config/alaventra-ssh, so every run does not register a new one.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
T=${TMPDIR:-/tmp}; T=${T%/}
mkdir -p "$HOME/.config/alaventra-ssh"
IMG=alaventra-gcloud:1   # the official image + openssh-client (gcloud.Dockerfile)
docker image inspect "$IMG" >/dev/null 2>&1 || docker build -q -t "$IMG" -f "$(dirname "$0")/gcloud.Dockerfile" "$(dirname "$0")" >/dev/null
if [ -n "${DOCKER_PUBLISH:-}" ]; then set -- -p "$DOCKER_PUBLISH" "$IMG" "$@"
else set -- "$IMG" "$@"; fi
exec docker run --rm -i \
  -v "$HOME/.config/gcloud:/root/.config/gcloud" \
  -v "$HOME/.config/alaventra-ssh:/root/.ssh" \
  -v "$ROOT:$ROOT" -v "$T:$T" -v /tmp:/tmp \
  -e TMPDIR="$T" -w "$ROOT" "$@"
