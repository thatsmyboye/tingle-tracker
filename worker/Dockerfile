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
    # Always upgrade yt-dlp[default] to latest at build time — yt-dlp-ejs
    # (included in the default group) ships updated challenge scripts alongside
    # yt-dlp; upgrading both together keeps the versions in sync as required.
    && pip install --no-cache-dir --upgrade "yt-dlp[default]"

COPY main.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
