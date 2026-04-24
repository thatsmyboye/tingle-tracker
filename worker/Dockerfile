FROM python:3.11-slim

# ffmpeg: WAV conversion. nodejs: yt-dlp YouTube EJS (without it, only android_vr
# clients run and metadata/formats are degraded; see yt-dlp wiki/EJS).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
