"""Genera la voz de ARIA (misma voz del bot: es-CO-SalomeNeural) para cada frase,
con tiempos por palabra para karaoke y sincronía de boca.

Uso (desde la carpeta del proyecto):
  "C:/Users/Windows 11 pro/ClaudeTelegram/venv/Scripts/python.exe" tools/gen_voice.py
"""
import asyncio, json, pathlib, sys

import edge_tts

VOICE, RATE, PITCH = "es-CO-SalomeNeural", "+6%", "+20Hz"  # igual que bot/config.py
ROOT = pathlib.Path(__file__).resolve().parent.parent
LINES = json.loads((ROOT / "tools" / "aria-lines.json").read_text(encoding="utf-8"))
OUT = ROOT / "public" / "aria" / "voice"
OUT.mkdir(parents=True, exist_ok=True)


async def gen(key, text, sem):
    async with sem:
        for attempt in range(3):
            try:
                com = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
                audio, words = bytearray(), []
                async for ch in com.stream():
                    if ch["type"] == "audio":
                        audio += ch["data"]
                    elif ch["type"] == "WordBoundary":
                        s = ch["offset"] / 1e7
                        words.append([round(s, 3), round(s + ch["duration"] / 1e7, 3), ch["text"]])
                (OUT / f"{key}.mp3").write_bytes(audio)
                dur = words[-1][1] if words else 0
                print(f"ok {key}: {len(words)} palabras, {dur:.1f}s", flush=True)
                return key, {"text": text, "words": words, "dur": dur}
            except Exception as e:  # reintento ante cortes de red
                print(f"retry {key}: {e}", file=sys.stderr, flush=True)
                await asyncio.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"fallo {key}")


async def main():
    only = set(sys.argv[1:])
    sem = asyncio.Semaphore(4)
    keys = [k for k in LINES if not only or k in only]
    res = await asyncio.gather(*(gen(k, LINES[k], sem) for k in keys))
    man_path = OUT / "manifest.json"
    manifest = json.loads(man_path.read_text(encoding="utf-8")) if man_path.exists() else {}
    manifest.update(dict(res))
    man_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    print("manifest:", len(manifest), "frases")


asyncio.run(main())
