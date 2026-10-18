# Alaventra engine: n8n with the SEO Agent workflows baked in, for a container host (Heroku, Render, Railway, Fly, Cloud Run, a VM).
# Build from n8n/:   docker build -f deploy/Dockerfile -t alaventra-n8n .
# Web process:       the image's default command (n8n start, on $PORT when the host sets one).
# Release step:      `seo-release` (imports the credentials and workflows, publishes them) — run it as the host's release /
#                    pre-deploy command, never at boot: every n8n CLI call starts n8n once, and boot timeouts are short. DEPLOY.md.
ARG N8N_VERSION=2.41.4
FROM docker.io/n8nio/n8n:${N8N_VERSION}

USER root
COPY seo-agent/deploy_manifest.json /opt/seo/deploy_manifest.json
COPY seo-agent/workflows/ /opt/seo/workflows/
COPY deploy/entrypoint.sh deploy/release.mjs /opt/seo/
RUN chmod 0555 /opt/seo/entrypoint.sh /opt/seo/release.mjs && chmod -R a+rX /opt/seo

USER node
# One container: Code nodes run in n8n's own task runner (the local stack's separate `runners` container and the sandbox services
# are not needed). The time zone is the one the weekly schedules were written for. No telemetry, no personalisation survey.
ENV N8N_RUNNERS_MODE=internal \
    N8N_RUNNERS_TASK_TIMEOUT=300 \
    N8N_PROXY_HOPS=1 \
    GENERIC_TIMEZONE=America/New_York \
    TZ=America/New_York \
    N8N_DIAGNOSTICS_ENABLED=false \
    N8N_PERSONALIZATION_ENABLED=false \
    N8N_VERSION_NOTIFICATIONS_ENABLED=false \
    N8N_HIRING_BANNER_ENABLED=false \
    N8N_BLOCK_ENV_ACCESS_IN_NODE=true \
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true \
    EXECUTIONS_DATA_PRUNE=true \
    EXECUTIONS_DATA_MAX_AGE=336

ENTRYPOINT ["tini", "--", "/opt/seo/entrypoint.sh"]
CMD ["start"]
