#!/bin/sh
# Maps a container host's conventions onto n8n's settings, then hands over to the stock n8n entrypoint.
#   PORT          (Heroku, Render, Railway, Cloud Run) -> N8N_PORT, plus a loopback forwarder on 5678: the workflows call their own
#                 instance at http://localhost:5678 (spawned runs, the schedule catch-up, the public API)
#   DATABASE_URL  (Heroku / Render / Railway Postgres) -> DB_TYPE=postgresdb and DB_POSTGRESDB_*; TLS on by default (managed Postgres
#                 requires it; its certificate is the provider's own, hence REJECT_UNAUTHORIZED=false unless you set it)
#   seo-release   as the command: run the release step (release.mjs) instead of n8n
# Every value already set explicitly wins.
set -eu

if [ -n "${DATABASE_URL:-}" ] && [ -z "${DB_TYPE:-}" ]; then
  eval "$(node -e '
    const u = new URL(process.env.DATABASE_URL);
    const q = (s) => "\x27" + decodeURIComponent(s).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    console.log([
      "export DB_TYPE=postgresdb",
      "export DB_POSTGRESDB_HOST=" + q(u.hostname),
      "export DB_POSTGRESDB_PORT=" + q(u.port || "5432"),
      "export DB_POSTGRESDB_DATABASE=" + q(u.pathname.replace(/^\//, "")),
      "export DB_POSTGRESDB_USER=" + q(u.username),
      "export DB_POSTGRESDB_PASSWORD=" + q(u.password),
    ].join("\n"));
  ')"
  export DB_POSTGRESDB_SSL_ENABLED="${DB_POSTGRESDB_SSL_ENABLED:-true}"
  export DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED="${DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED:-false}"
fi

if [ "${1:-}" = "seo-release" ]; then
  exec node /opt/seo/release.mjs
fi

if [ -n "${PORT:-}" ] && [ -z "${N8N_PORT:-}" ]; then
  export N8N_PORT="$PORT"
fi
if [ -n "${N8N_PORT:-}" ] && [ "$N8N_PORT" != "5678" ]; then
  node -e '
    const net = require("net"), port = Number(process.env.N8N_PORT);
    net.createServer((s) => {
      const c = net.connect(port, "127.0.0.1");
      s.pipe(c).pipe(s);
      c.on("error", () => s.destroy());
      s.on("error", () => c.destroy());
    }).listen(5678, "127.0.0.1");
  ' &
fi

exec /docker-entrypoint.sh "$@"
