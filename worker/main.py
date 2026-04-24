import os
import tempfile
import subprocess
import math
from pathlib import Path

import numpy as np
import librosa
import uvicorn
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

WORKER_SECRET = os.environ.get("AUDIO_WORKER_SECRET", "")
WINDOW_SECONDS = 30
SR = 22050  # librosa default — 22.05 kHz mono

# YouTube video IDs are always 11 characters from [A-Za-z0-9_-].
_YOUTUBE_VIDEO_ID_RE = r"^[\w-]{11}$"

app = FastAPI()


class ExtractRequest(BaseModel):
    youtube_video_id: str = Field(..., min_length=11, max_length=11, pattern=_YOUTUBE_VIDEO_ID_RE)
    duration_seconds: float = Field(..., ge=0, le=86400 * 48)


@app.get("/")
def root():
    return {"service": "tingle-audio-worker", "status": "ok", "endpoints": ["/health", "/extract"]}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract")
def extract_audio_features(
    body: ExtractRequest,
    x_worker_secret: str = Header(default=""),
) -> dict:
    if WORKER_SECRET and x_worker_secret != WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    url = f"https://www.youtube.com/watch?v={body.youtube_video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = str(Path(tmpdir) / "audio.%(ext)s")

        result = subprocess.run(
            [
                "yt-dlp",
                "--extract-audio",
                "--audio-format", "wav",
                "--audio-quality", "0",
                "--no-playlist",
                "--retries", "10",
                "--fragment-retries", "10",
                "--file-access-retries", "5",
                "--quiet",
                "-o", output_template,
                url,
            ],
            capture_output=True,
            text=True,
            timeout=720,  # 12 min — long ASMR videos can be slow to download
        )

        if result.returncode != 0:
            # 502: upstream download/extract failed — not a malformed client payload (422).
            raise HTTPException(
                status_code=502,
                detail=f"yt-dlp failed: {result.stderr[:400]}",
            )

        wav_files = list(Path(tmpdir).glob("audio.*"))
        if not wav_files:
            raise HTTPException(status_code=500, detail="No audio file produced by yt-dlp")

        audio_path = str(wav_files[0])
        features = _extract_features_chunked(audio_path, body.duration_seconds)

    return {"features": features}


def _finite(x: float, default: float = 0.0) -> float:
    """JSON must not contain NaN/Infinity — Node's JSON.parse rejects them."""
    return float(x) if math.isfinite(x) else default


def _extract_features_chunked(wav_path: str, fallback_duration_seconds: float) -> list[dict]:
    """
    Load the WAV file in 30-second chunks so memory stays constant regardless
    of video length (~2.6 MB per chunk at 22050 Hz mono float32).
    """
    try:
        duration_seconds = float(librosa.get_duration(path=wav_path))
    except Exception:
        duration_seconds = 0.0

    if not math.isfinite(duration_seconds) or duration_seconds <= 0:
        duration_seconds = float(fallback_duration_seconds or 0)

    if duration_seconds <= 0:
        return []

    n_windows = math.ceil(duration_seconds / WINDOW_SECONDS)
    features = []

    for i in range(n_windows):
        offset = float(i * WINDOW_SECONDS)
        chunk_duration = min(float(WINDOW_SECONDS), duration_seconds - offset)

        if chunk_duration < 2.0:
            # Skip slivers at the end of the video
            continue

        try:
            y, _ = librosa.load(
                wav_path,
                sr=SR,
                offset=offset,
                duration=float(WINDOW_SECONDS),
                mono=True,
            )
        except Exception:
            continue

        if len(y) < SR * 2:
            continue

        rms = float(np.sqrt(np.mean(y ** 2)))
        centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=SR)[0]))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)[0]))

        features.append({
            "bucket_start_ms": int(offset * 1000),
            "bucket_end_ms": int(min(offset + WINDOW_SECONDS, duration_seconds) * 1000),
            "rms_energy": round(_finite(rms), 6),
            "spectral_centroid": round(_finite(centroid), 2),
            "zero_crossing_rate": round(_finite(zcr), 6),
        })

    return features


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
