FROM python:3.11-slim

# ffmpeg: WAV conversion. nodejs: yt-dlp n-challenge solver (requires a `node`
# binary in PATH; see yt-dlp wiki/EJS). Debian's nodejs package installs
# /usr/bin/nodejs — symlink to /usr/bin/node so yt-dlp can find it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    && ln -sf /usr/bin/nodejs /usr/bin/node \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
