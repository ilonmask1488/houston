"""
Аудио для всего контента → public/audio + public/audio/manifest.json.

  .venv\\Scripts\\python.exe scripts\\generate_audio.py        (Windows)
  .venv/bin/python scripts/generate_audio.py                   (macOS/Linux)

Голоса edge-tts разных акцентов (US, UK, Индия, Австралия), скорость 1.0 — лестница 0.75/1.25
делается в приложении (playbackRate с сохранением высоты).
Кэш TTS — по хэшу (текст + голос + скорость): повторный запуск ничего не перегенерирует.
В конце — отчёт для проверки на слух: docs/audio-review.md (фразы со связной речью).
"""
import asyncio
import hashlib
import json
import re
import shutil
import sys

from audio_lib import AUDIO, CACHE, MANIFEST, ROOT, VOICES, collect_needs, decode, encode, process, sources, text_stem

RATE = "+0%"
PARALLEL = 6

# Явления связной речи, которые синтез может прочитать «по-книжному». Такие фразы — в отчёт на проверку.
CONNECTED = [
    (re.compile(r"\b(gonna|wanna|gotta|kinda|lemme|gimme|didja|whaddaya|dunno)\b", re.I), "разговорная форма"),
    (re.compile(r"\b\w+'(ve|d|ll)\b|n't've\b", re.I), "сокращение"),
    (re.compile(r"\b(did|would|could|should) you\b", re.I), "уподобление d + you"),
    (re.compile(r"\b(want|going|got|have) to\b", re.I), "слабая форма to"),
    (re.compile(r"\b(next|last|first|must) (d|t|n|m|s)\w*", re.I), "выпадение t"),
]


async def tts(text: str, voice: str) -> bytes:
    key = hashlib.sha1(f"{text}|{voice}|{RATE}".encode()).hexdigest()
    path = CACHE / "tts" / f"{key}.mp3"
    if path.exists():
        return path.read_bytes()
    import edge_tts

    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            comm = edge_tts.Communicate(text, voice, rate=RATE)
            data = b""
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    data += chunk["data"]
            if not data:
                raise RuntimeError(f"TTS вернул пустой звук: {text} / {voice}")
            path.write_bytes(data)
            return data
        except Exception:
            if attempt == 2:
                raise
            await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


async def fetch_all(pairs: list[tuple[str, str]]) -> dict[tuple[str, str], bytes]:
    sem = asyncio.Semaphore(PARALLEL)
    out: dict[tuple[str, str], bytes] = {}
    done = 0

    async def one(text: str, voice_key: str):
        nonlocal done
        async with sem:
            out[(text, voice_key)] = await tts(text, VOICES[voice_key])
            done += 1
            if done % 50 == 0:
                print(f"  синтез: {done} из {len(pairs)}", flush=True)

    await asyncio.gather(*(one(t, v) for t, v in pairs))
    return out


def main() -> int:
    needs = collect_needs()
    pairs = sorted(needs)
    print(f"Нужно звуков: {len(pairs)}")
    try:
        raw = asyncio.run(fetch_all(pairs))
    except Exception as e:  # сеть, edge-tts недоступен и т.п. — не молчим
        print(f"\nОШИБКА: {e}", file=sys.stderr)
        print(
            "Если это сетевая ошибка edge-tts: сервис Microsoft мог быть недоступен из твоей сети. "
            "Попробуй позже, из другой сети или через VPN. Уже скачанное лежит в кэше scripts/.cache.",
            file=sys.stderr,
        )
        return 1

    # Старые файлы удаляем: имена с хэшем, всё пересоздаётся из кэша за секунды.
    for d in AUDIO.iterdir() if AUDIO.exists() else []:
        if d.is_dir():
            shutil.rmtree(d, ignore_errors=True)

    manifest = {"version": 1, "sources": sources(), "texts": {}}
    review: list[str] = []
    reviewed_texts: set[str] = set()
    tmp = CACHE / "tmp.mp3"
    for text, voice_key in pairs:
        tmp.write_bytes(raw[(text, voice_key)])
        file, ms = encode(process(decode(tmp)), AUDIO / needs[(text, voice_key)], f"{voice_key}-{text_stem(text)}")
        manifest["texts"].setdefault(text, []).append({"voice": voice_key, "file": file, "source": f"edge-{voice_key}", "ms": ms})
        # На проверку — только фразы для аудирования (Эфир и вводный тест): там связная речь и есть предмет урока.
        if not (needs[(text, voice_key)].startswith("air") or needs[(text, voice_key)] == "intake") or text in reviewed_texts:
            continue
        for rx, what in CONNECTED:
            if rx.search(text):
                review.append(f"| {text} | {voice_key} | {what} |")
                reviewed_texts.add(text)
                break

    AUDIO.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    size = sum(p.stat().st_size for p in AUDIO.rglob("*.mp3"))
    print(f"Фраз: {len(manifest['texts'])}, файлов: {len(pairs)}, {size / 1024 / 1024:.1f} МБ")

    report = ROOT / "docs" / "audio-review.md"
    report.write_text(
        "# Звук на проверку на слух\n\n"
        "Генерируется `scripts/generate_audio.py`. Здесь фразы со связной речью: синтез может произнести их\n"
        "слишком «по-книжному» (want to вместо wanna, did you без didja). Послушай на скорости 1.0;\n"
        "если звучит неестественно — отметь фразу в этом файле, её заменят или перепишут через разговорную форму.\n\n"
        "| Фраза | Голос | Что проверить |\n|---|---|---|\n" + "\n".join(review) + "\n",
        encoding="utf-8",
    )
    print(f"На проверку на слух: {len(review)} позиций → docs/audio-review.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
