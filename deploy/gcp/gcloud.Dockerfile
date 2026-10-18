# gcloud + an SSH client: the official image has no `ssh`, which `gcloud compute ssh --tunnel-through-iap` needs (tunnel.sh,
# migrate_data.py, deploy_engine.py --create-missing). Built once by gcloud-docker.sh as alaventra-gcloud:1.
FROM gcr.io/google.com/cloudsdktool/google-cloud-cli:stable
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssh-client && rm -rf /var/lib/apt/lists/*
