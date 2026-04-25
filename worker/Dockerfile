FROM python:3.11-slim

# ffmpeg: WAV conversion. nodejs: yt-dlp n-challenge solver (requires a `node`
# binary in PATH; see yt-dlp wiki/EJS). Install Node.js via NodeSource because
# the Debian slim image's default sources don't reliably provide it; NodeSource
# places the binary at /usr/bin/node directly (no symlink needed).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
