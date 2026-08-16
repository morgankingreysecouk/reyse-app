#!/bin/bash
# Wraps `prisma migrate deploy` with a short retry-with-backoff before
# starting the server. A freshly-provisioned Postgres addon (or a brief
# private-network blip on cold start) can take a few seconds to become
# reachable -- without this, the very first connection attempt losing that
# race kills the whole start command, and Railway does not automatically
# retry a crashed deploy. Confirmed the hard way: a brand-new database
# attached the same time as the service left the deploy permanently down
# until manually retriggered.
set -euo pipefail

MAX_ATTEMPTS=6
DELAY=5

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if npx prisma migrate deploy; then
    exec next start
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "prisma migrate deploy failed after $MAX_ATTEMPTS attempts -- giving up." >&2
    exit 1
  fi

  echo "prisma migrate deploy failed (attempt $attempt/$MAX_ATTEMPTS) -- database may still be starting up, retrying in ${DELAY}s..." >&2
  sleep "$DELAY"
  DELAY=$((DELAY * 2))
done
