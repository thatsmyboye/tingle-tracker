FROM python:3.11-slim

# ffmpeg: WAV conversion. nodejs: yt-dlp n-challenge solver (requires a `node`
# binary in PATH; see yt-dlp wiki/EJS). Install Node.js via NodeSource because
# the Debian slim image's default sources don't reliably provide it; NodeSource
# places the binary at /usr/bin/node directly (no symlink needed).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    git \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Build the bgutil HTTP server that supplies GVS PO Tokens to yt-dlp's mweb
# client. The bgutil-ytdlp-pot-provider pip plugin (requirements.txt) connects
# to this server at port 4416; entrypoint.sh starts it before uvicorn.
RUN git clone --depth 1 --branch 1.3.1 --single-branch \
        https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /bgutil \
    && cd /bgutil/server \
    && npm ci \
    && npx tsc \
    && rm -rf /bgutil/.git /bgutil/server/node_modules/.cache

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    # Always upgrade yt-dlp to latest at build time — YouTube rotates the
    # n-challenge JS frequently; a stale solver produces the EJS warning and
    # missing formats even when Node.js is present.
    && pip install --no-cache-dir --upgrade yt-dlp

COPY main.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
