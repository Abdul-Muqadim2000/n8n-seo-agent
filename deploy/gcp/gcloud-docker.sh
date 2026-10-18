#!/bin/sh
# gcloud in Docker for a machine without the Cloud SDK: GCLOUD="deploy/gcp/gcloud-docker.sh gcloud" deploy/gcp/bootstrap.sh
# Mounts your gcloud login, this repository and the temp directories at the SAME paths, so the files the scripts hand to gcloud
# (startup script, lifecycle and policy JSON, secret payloads) resolve inside the container exactly as outside.
# Pass-through stdin (-i) so `--data-file=-` works; no TTY so output can be captured.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
T=${TMPDIR:-/tmp}; T=${T%/}
exec docker run --rm -i \
  -v "$HOME/.config/gcloud:/root/.config/gcloud" \
  -v "$ROOT:$ROOT" -v "$T:$T" -v /tmp:/tmp \
  -e TMPDIR="$T" -w "$ROOT" \
  gcr.io/google.com/cloudsdktool/google-cloud-cli:stable "$@"
