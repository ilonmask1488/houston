"""Общие функции аудиоконвейера: голоса, сбор текстов из контента, обрезка тишины, громкость, mp3."""
import hashlib
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src" / "content"
AUDIO = ROOT / "public" / "audio"
MANIFEST = AUDIO / "manifest.json"
CACHE = Path(__file__).resolve().parent / ".cache"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

SR = 24000  # речи хватает полосы до 12 кГц
TARGET_RMS_DB = -18.0
PEAK_LIMIT_DB = -1.0

# Голоса: акцент + пол → голос edge-tts. Разные акценты — потому что на работе собеседники будут разные.
VOICES = {
    "us-f": "en-US-AvaNeural",
    "us-m": "en-US-AndrewNeural",
    "gb-f": "en-GB-SoniaNeural",
    "gb-m": "en-GB-RyanNeural",
    "in-f": "en-IN-NeerjaNeural",
    "in-m": "en-IN-PrabhatNeural",
    "au-f": "en-AU-NatashaNeural",
    "au-m": "en-AU-WilliamMultilingualNeural",
}

ACCENT_NAMES = {"us": "американский", "gb": "британский", "in": "индийский", "au": "австралийский"}


def sources() -> dict:
    return {
        f"edge-{k}": {
            "name": f"Синтез речи Microsoft Edge, голос {v} ({ACCENT_NAMES[k[:2]]})",
            "url": "https://github.com/rany2/edge-tts",
            "license": "синтез для личного использования",
            "credit": "Microsoft",
        }
        for k, v in VOICES.items()
    }


def decode(path: Path) -> np.ndarray:
    out = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-9))


def process(x: np.ndarray) -> np.ndarray:
    """Обрезать тишину по краям, выровнять громкость по звучащей части, мягкие края."""
    frame = int(0.01 * SR)
    n = len(x) // frame
    if n == 0:
        raise ValueError("пустой звук")
    rms = np.array([np.sqrt(np.mean(x[i * frame : (i + 1) * frame] ** 2)) for i in range(n)])
    peak_db = db(float(np.abs(x).max()))
    thr = max(peak_db - 40.0, -55.0)
    loud = np.where(20 * np.log10(np.maximum(rms, 1e-9)) > thr)[0]
    if not len(loud):
        raise ValueError("не найден звук")
    start = max(0, (loud[0] - 5) * frame)  # 50 мс до
    end = min(len(x), (loud[-1] + 12) * frame)  # 120 мс после
    y = x[start:end].astype(np.float64)

    voiced = rms[loud[0] : loud[-1] + 1]
    voiced = voiced[20 * np.log10(np.maximum(voiced, 1e-9)) > thr]
    cur = db(float(np.sqrt(np.mean(voiced**2))))
    gain = 10 ** ((TARGET_RMS_DB - cur) / 20)
    peak_after = np.abs(y).max() * gain
    limit = 10 ** (PEAK_LIMIT_DB / 20)
    if peak_after > limit:
        gain *= limit / peak_after
    y *= gain

    fi, fo = int(0.008 * SR), int(0.02 * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)
    return y.astype(np.float32)


def encode(y: np.ndarray, dst_dir: Path, stem: str) -> tuple[str, int]:
    """Кодирует в mp3 (моно, 48 кбит/с) с хэшем содержимого в имени. Возвращает (путь от public/audio, мс)."""
    data = subprocess.run(
        [FFMPEG, "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "-"],
        input=y.tobytes(),
        capture_output=True,
        check=True,
    ).stdout
    h = hashlib.sha1(data).hexdigest()[:8]
    dst_dir.mkdir(parents=True, exist_ok=True)
    name = f"{stem}-{h}.mp3"
    (dst_dir / name).write_bytes(data)
    return (dst_dir / name).relative_to(AUDIO).as_posix(), int(len(y) / SR * 1000)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def text_stem(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def collect_needs() -> dict[tuple[str, str], str]:
    """
    Все пары (текст, голос), которым нужен звук, → подпапка.
    Правила обхода JSON контента (src/content/**.json):
      - объект с "voice": озвучить "say" (как произносит синтез) или "text", или "q", или "answer";
        если есть "answer" и "options" (минимальные пары) — все варианты тем же голосом;
      - объект с "voices": [..] и "text"/"say" — каждым из голосов;
      - объект с "speak": [{"text", "voice"}] — явный список.
    """
    needs: dict[tuple[str, str], str] = {}

    def add(text: str, voice: str, sub: str):
        text = text.strip()
        if not text:
            return
        if voice not in VOICES:
            raise ValueError(f"неизвестный голос {voice} для «{text}»")
        needs.setdefault((text, voice), sub)

    def walk(v, sub: str):
        if isinstance(v, list):
            for x in v:
                walk(x, sub)
        elif isinstance(v, dict):
            spoken = v.get("say") or v.get("text") or v.get("q")
            if isinstance(v.get("voice"), str):
                if isinstance(v.get("answer"), str) and isinstance(v.get("options"), list):
                    for o in v["options"]:
                        add(o, v["voice"], sub)
                elif spoken:
                    add(spoken, v["voice"], sub)
            if isinstance(v.get("voices"), list) and spoken:
                for voice in v["voices"]:
                    add(spoken, voice, sub)
            if isinstance(v.get("speak"), list):
                for s in v["speak"]:
                    add(s["text"], s["voice"], sub)
            for k, x in v.items():
                if k not in ("speak",):
                    walk(x, sub)

    for path in sorted(CONTENT.rglob("*.json")):
        sub = path.relative_to(CONTENT).with_suffix("").as_posix().replace("/", "-")
        walk(load_json(path), sub)
    return needs
