#!/bin/sh
set -e

# Upgrade yt-dlp in the background while bgutil starts. YouTube rotates the
# n-challenge JS solver frequently; a build-time install drifts stale within
# days and produces "n challenge solving failed" even when Node.js is present.
pip install --upgrade --quiet "yt-dlp[default]" &
YTDLP_UPGRADE_PID=$!

# Start the bgutil HTTP server (GVS PO Token provider for yt-dlp mweb client).
# The bgutil-ytdlp-pot-provider pip plugin connects to this at port 4416
# automatically — no extra yt-dlp flags needed.
node /bgutil/server/build/main.js &

# Wait up to 15s for bgutil to be ready before uvicorn starts accepting requests.
i=0
while [ $i -lt 15 ]; do
    if curl -sf http://127.0.0.1:4416/ping > /dev/null 2>&1; then
        break
    fi
    sleep 1
    i=$((i + 1))
done

# Wait for the yt-dlp upgrade before accepting requests so the solver is current.
# Falls through if the upgrade fails (e.g. no network) — stale version still works.
wait $YTDLP_UPGRADE_PID || echo "yt-dlp upgrade failed; proceeding with installed version"

exec uvicorn main:app --host 0.0.0.0 --port 8000
