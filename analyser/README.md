# Web statement analyser: engine

Decision [0034](https://github.com/pesaclarity/docs/blob/main/decisions/0034-privacy-first-web-statement-analyser.md).
A statement PDF is read in the browser, in a Web Worker. Nothing is uploaded:
the page only fetches the analyser's own files from this site.

This folder is the engine only. The page that uses it is not built yet (it
waits for approved mockups).

## How it reads a statement

1. **pdf.js** (pdfjs-dist 6.5.438, legacy build, self-hosted) opens the PDF,
   with the password if it has one, and gives each character with its box
   (`web/extract.mjs`), the way the app gets them from PDFium.
2. **The app's Dart**, compiled to WebAssembly (`engine/`), groups the
   characters into words (`pageFromCharacters`), reads the statement with the
   app's statement packs (ujumbe, the same commit as the app), and
   categorises each transaction as the app does on a fresh install: its
   rules first, then the categoriser model, with the same thresholds.
3. **rayo** (WebAssembly, `rayo-simd.wasm`, or `rayo.wasm` without SIMD) runs
   the categoriser model the app ships.

`engine/lib/app/` is the app's own code, copied unchanged by
`engine/tool/sync_app.dart` (hashes in `engine/app_sources.json`). Only
`engine/lib/analyser.dart` and `engine/web/engine.dart` are new.

It is compiled with `dart compile wasm`, not to JavaScript: the encoders'
FNV-1a hashes need exact 64-bit integers, and dart2js gives different token
ids. Dart's wasm output needs WasmGC and the new exception handling
(Chrome and Edge 137+, Firefox 131+, Safari 18.4+, Node 24).

## Files

| Path              | What                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `web/core.mjs`    | Loads everything; `createAnalyser(load)` gives `analyse(bytes, password)` |
| `web/worker.mjs`  | The Web Worker the page will start (messages documented in it)            |
| `web/extract.mjs` | pdf.js text to per-character boxes                                        |
| `engine/`         | Dart package: the app's code plus the joining-up                          |
| `models/`         | The app's categoriser (weights, labels, manifest)                         |
| `rayo.json`       | The rayo commit `rayo*.wasm` and `rayo.mjs` are built from                |
| `fixtures/`       | Synthetic statements only (made-up names and numbers)                     |
| `goldens/`        | What the app reads from each fixture, recorded in the app                 |
| `build.json`      | SHA-256 of each built file in `public/analyser/`                          |

## Build and test

```sh
npm ci
analyser/build.sh                       # Dart SDK 3.9+; writes public/analyser/
RAYO=../rayo WASI_SDK=/opt/wasi-sdk analyser/build.sh   # also rebuild rayo
node --test tests/analyser.test.mjs     # Node 24
```

The tests check, for every fixture and on both rayo builds, that the engine
gives the app's transactions, balances and categories, with the same
confidences bit for bit; that the encoders give the app's test vectors; that
the categoriser on rayo wasm gives the app's recorded outputs; and that the
committed files match their hashes.

## Updating from the app

```sh
cd analyser/engine && dart run tool/sync_app.dart ../../../pesaclarity-app   # lib/app, models/, goldens/app/
cd ../.. && analyser/build.sh
python3 analyser/fixtures/make_statements.py ../pesaclarity-app
analyser/engine/tool/app_goldens.sh ../pesaclarity-app   # Flutter, PDFium
node --test tests/analyser.test.mjs
```

`sync_app.dart` copies the app's `lib/src` code into `engine/lib/app`, its
shipped categoriser model into `models/`, and its encoder vectors and
recorded categoriser outputs (`test/fixtures/categoriser/feature_vectors.v1.json`,
`categoriser_decodes.json`, `test/fixtures/reader/reader_vectors.v1.json`)
into `goldens/app/`, and records each file's SHA-256 in
`engine/app_sources.json`; the tests fail if any of them is edited by hand.
Don't copy these files by hand.

Also move the ujumbe pin in `engine/pubspec.yaml` when the app moves it.

## Privacy rules for the page

- Strict Content Security Policy: `default-src 'self'`, `script-src 'self'
'wasm-unsafe-eval'`, `worker-src 'self'`, `connect-src 'self'`; no
  third-party scripts, fonts or analytics.
- The PDF and the password go to the worker only, are never stored, and are
  never sent anywhere. The worker fetches nothing but this folder's files.
- Never use a real statement in fixtures, tests or screenshots.
