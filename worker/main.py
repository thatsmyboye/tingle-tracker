import base64
import os
import tempfile
import subprocess
import math
import logging
from pathlib import Path

import numpy as np
import librosa
import uvicorn
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

WORKER_SECRET = os.environ.get("AUDIO_WORKER_SECRET", "")

# YouTube uses a curly right-single-quote (U+2019) in this message; include both
# variants so the pattern matches regardless of yt-dlp version or locale.
_BOT_DETECTION_PATTERNS = (
    "Sign in to confirm you’re not a bot",
    "Sign in to confirm you're not a bot",
)


def _resolve_cookies_file() -> str:
    """Return path to a readable Netscape-format cookies file, or empty string.

    Priority:
      1. YT_DLP_COOKIES_B64 — base64-encoded file content (Fly.io secret pattern:
         fly secrets set YT_DLP_COOKIES_B64="$(base64 -w0 cookies.txt)")
      2. YT_DLP_COOKIES_FILE / YT_DLP_COOKIES_PATH — direct filesystem path
    """
    b64 = os.environ.get("YT_DLP_COOKIES_B64", "").strip()
    if b64:
        try:
            decoded = base64.b64decode(b64)
        except Exception as exc:
            logging.getLogger("tingle_audio_worker").warning(
                "YT_DLP_COOKIES_B64 is set but not valid base64: %s", exc
            )
        else:
            dest = Path("/tmp/yt_dlp_cookies.txt")
            dest.write_bytes(decoded)
            return str(dest)

    path_str = os.environ.get("YT_DLP_COOKIES_FILE") or os.environ.get(
        "YT_DLP_COOKIES_PATH", ""
    )
    if path_str:
        if Path(path_str).is_file():
            return path_str
        logging.getLogger("tingle_audio_worker").warning(
            "YT_DLP_COOKIES_FILE set but not a readable file: %s", path_str
        )
    return ""


WINDOW_SECONDS = 30
SR = 22050  # librosa default — 22.05 kHz mono

# YouTube video IDs are always 11 characters from [A-Za-z0-9_-].
_YOUTUBE_VIDEO_ID_RE = r"^[\w-]{11}$"

app = FastAPI()
log = logging.getLogger("tingle_audio_worker")


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

    # Re-resolve cookies on every request so a newly-set YT_DLP_COOKIES_B64
    # Fly secret is picked up immediately (Fly restarts the machine on secret
    # changes, but this also guards against mid-session env changes).
    cookies_file = _resolve_cookies_file()

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = str(Path(tmpdir) / "audio.%(ext)s")
        cmd = _yt_dlp_command(output_template, url, cookies_file)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=720,  # 12 min — long ASMR videos can be slow to download
            )
        except subprocess.TimeoutExpired:
            log.warning(
                "yt-dlp timed out after 720s for youtube_video_id=%s",
                body.youtube_video_id,
            )
            raise HTTPException(
                status_code=502,
                detail="yt-dlp timed out after 720s",
            ) from None

        if result.returncode != 0:
            err_output = result.stderr or result.stdout or ""
            err_tail = err_output[:800]
            if any(p in err_output for p in _BOT_DETECTION_PATTERNS):
                cookies_configured = "yes" if cookies_file else "no"
                log.error(
                    "yt-dlp bot-detection block youtube_video_id=%s cookies_configured=%s — "
                    "set YT_DLP_COOKIES_B64 Fly secret or verify extractor-args; stderr_tail=%r",
                    body.youtube_video_id,
                    cookies_configured,
                    err_tail,
                )
                # 503: retryable/configurable — cookies or extractor-args will fix it.
                raise HTTPException(
                    status_code=503,
                    detail=f"yt-dlp bot-detection block (cookies_configured={cookies_configured}): {(result.stderr or '')[:400]}",
                )
            log.warning(
                "yt-dlp failed rc=%s youtube_video_id=%s stderr_tail=%r",
                result.returncode,
                body.youtube_video_id,
                err_tail,
            )
            # 502: upstream download/extract failed — not a malformed client payload (422).
            raise HTTPException(
                status_code=502,
                detail=f"yt-dlp failed: {(result.stderr or '')[:400]}",
            )

        wav_files = list(Path(tmpdir).glob("audio.*"))
        if not wav_files:
            raise HTTPException(status_code=500, detail="No audio file produced by yt-dlp")

        audio_path = str(wav_files[0])
        features = _extract_features_chunked(audio_path, body.duration_seconds)

    return {"features": features}


def _yt_dlp_command(output_template: str, url: str, cookies_file: str = "") -> list[str]:
    """Build yt-dlp argv for datacenter IPs (Fly.io EWR).

    Client priority for datacenter IPs (2026):
      ios     — iOS app client; no PO token required, no SABR, no n-challenge.
                Skipped by yt-dlp when cookies are active (incompatible with
                Netscape-format cookies), so android handles the cookies case.
      android — Android app client; no n-challenge (uses direct CDN URLs without
                the `n` throttle parameter), no POT tokens required, accepts
                cookies, works on datacenter IPs. Primary fallback when ios is
                skipped due to cookies.
      mweb    — Mobile web client; last resort. No SABR, cookies-compatible, but
                requires n-challenge solving (EJS via Node.js) AND a GVS PO Token
                (bgutil-ytdlp-pot-provider). If the bundled n-challenge solver
                drifts stale the mweb formats are silently skipped.

    Dropped:
      tv_embedded — YouTube removed this player client (~late 2024); yt-dlp logs
                    "Skipping unsupported client" and yields zero formats.
      web_creator — Subject to YouTube's SABR-only streaming experiment on
                    datacenter IPs; https formats are stripped, leaving nothing.

    GVS PO Token: bgutil-ytdlp-pot-provider registers as a yt-dlp-get-pot
    provider and is auto-discovered by yt-dlp at startup (namespace package).
    Node.js 20.x must be in PATH (ensured by Dockerfile via NodeSource).

    If bot-detection blocks persist, set YT_DLP_COOKIES_B64 (Fly secret) to a
    base64-encoded Netscape-format cookies export from a signed-in browser.
    """
    args: list[str] = [
        "yt-dlp",
        "--extractor-args", "youtube:player_client=ios,android,mweb",
        "--extract-audio",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "--no-playlist",
        "--retries", "10",
        "--fragment-retries", "10",
        "--file-access-retries", "5",
        "--quiet",
        "-o", output_template,
    ]
    if cookies_file and Path(cookies_file).is_file():
        args.extend(["--cookies", cookies_file])
    args.append(url)
    return args


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
