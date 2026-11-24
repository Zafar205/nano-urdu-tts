# Nano Urdu TTS

A tiny Urdu text-to-speech voice (443,402 parameters, ≈500 KB as int8) that runs
**entirely in the browser**. The site is a static Next.js export: there is no
server, so it hosts for free on Vercel.

## How it fits together

| Piece | Where | Licence |
|---|---|---|
| Urdu text normalization and phone mapping | `lib/urdu.ts` (port of the training project's `urdu_frontend.py` / `phones.py`) | — |
| Pronunciation (Urdu text → IPA) | eSpeak NG 1.52.0 built to WebAssembly (`wasm/espeak_glue.c`) | GPL-3.0-or-later |
| The voice (IPA → 24 kHz audio) | sanoTTS int8 runtime built to WebAssembly (`wasm/runtime/`, `wasm/nano_glue.c`), weights in `wasm/voice/` | MIT runtime; voice trained from CC BY-NC 4.0 data |
| UI and worker | `components/Tts.tsx`, `lib/engine.ts`, `public/tts-worker.js` | — |

**Non-commercial use only.** The voice was distilled from Meta's MMS-TTS Urdu model
and the UrduTTS corpus, both CC BY-NC 4.0.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static site in out/
```

The compiled WebAssembly (`public/wasm/`) is committed, because Vercel's build has
no Emscripten. To rebuild it (needs `brew install emscripten espeak-ng`, with
espeak-ng at version 1.52.0 for its compiled Urdu data):

```bash
bash wasm/build.sh
node wasm/verify.mjs <reference dir>   # compare against Python reference audio
```

`wasm/verify.mjs` checks the browser build against audio from the Python pipeline
(`urdu_frontend.phones_for` + `speak.render`). Build the Python reference with
`-ffp-contract=off`: native Apple-silicon builds fuse multiply-adds and
WebAssembly does not; with fusing off the two agree to ~1e-7.

## Deploy to Vercel

Import the repository in Vercel (Framework preset: Next.js, no settings to
change). `output: "export"` in `next.config.ts` makes it a static site.
