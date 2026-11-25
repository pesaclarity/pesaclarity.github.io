#!/usr/bin/env bash
# Builds the analyser's engine into public/analyser/, served as is by the
# site (decision 0034). Everything it loads is in that folder: no CDN.
#
#   analyser/build.sh                       the Dart engine, pdf.js, the models
#   RAYO=../rayo WASI_SDK=/opt/wasi-sdk analyser/build.sh
#                                           also rebuild rayo.wasm from a rayo
#                                           checkout (at the commit in
#                                           analyser/rayo.json)
#
# Needs the Dart SDK (3.9 or later) and `npm ci` (for pdfjs-dist). The
# output is committed, so the site builds without Dart or wasi-sdk;
# tests/analyser.test.mjs checks it against analyser/build.json.
set -euo pipefail
cd "$(dirname "$0")/.."
out=public/analyser
mkdir -p "$out"

(cd analyser/engine && dart pub get >/dev/null &&
  dart compile wasm -O2 --no-source-maps web/engine.dart -o ../../$out/engine.wasm >/dev/null)
rm -f "$out/engine.support.js" "$out/engine.wasm.map"

# The legacy build: it runs on older phone browsers too.
cp node_modules/pdfjs-dist/legacy/build/pdf.min.mjs node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs "$out/"
cp analyser/web/core.mjs analyser/web/extract.mjs analyser/web/worker.mjs "$out/"
cp analyser/models/categoriser.weights analyser/models/labels.json \
  analyser/models/model-manifest.json "$out/"

if [ -n "${RAYO:-}" ]; then
  want=$(node -p 'require("./analyser/rayo.json").commit')
  have=$(git -C "$RAYO" rev-parse HEAD)
  [ "$want" = "$have" ] || { echo "rayo is at $have, analyser/rayo.json says $want" >&2; exit 1; }
  tmp=$(mktemp -d)
  (cd "$RAYO" && wasm/build.sh "$tmp" >/dev/null)
  cp "$tmp/rayo.wasm" "$tmp/rayo-simd.wasm" "$RAYO/wasm/rayo.mjs" "$out/"
  rm -rf "$tmp"
fi

node analyser/hashes.mjs > analyser/build.json
cat analyser/build.json
