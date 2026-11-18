---
title: "Overview"
description: "On-device inference in plain C89 (ANSI C), for C, Dart and Flutter. A general runtime for small models: a graph of ops (docs/OPS.md) over a plain-weights file, converted from a TFLite or ONNX model by rayo-convert…"
section: "rayo"
order: 11
repo: "rayo"
path: "README.md"
commit: "b7838f6648e8f100674d0e70412c092bb2c6bb6d"
source: "https://github.com/pesaclarity/rayo/blob/b7838f6648e8f100674d0e70412c092bb2c6bb6d/README.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/README.md"
---
On-device inference in plain C89 (ANSI C), for C, Dart and Flutter. A general runtime for
small models: a graph of ops (docs/OPS.md) over a plain-weights file, converted from a TFLite
or ONNX model by `rayo-convert` (docs/CONVERTING.md), with ops of your own when those are not
enough. Pesa Clarity's question reader and reply writer run on it, on the phone,
offline, in the Play and the F-Droid builds alike; nothing in the library is specific to them.

## What rayo can do

- **Plain C89, and nothing else.** Every C file builds with gcc and clang as `-std=c89
  -pedantic -Werror` ([C89](#c89)). No C++, no Google code (no TFLite/LiteRT, no XNNPACK), no
  other library. A Dart build hook compiles `src/` with the platform's C compiler (the NDK,
  Xcode, clang/gcc): nothing is downloaded or prebuilt, so F-Droid builds it offline. SIMD
  intrinsics live only in `src/kernels/x86*.c` and `src/kernels/neon*.c`, and the system's
  headers (mmap, threads, the CPU's cores) only in `src/platform/`, with plain C89 fallbacks.
- **Every common CPU, the best kernels picked at run time.** Generic C everywhere; SSE4.1,
  AVX2 and AVX-VNNI on x86; NEON and the ARMv8.2 dot product (SDOT) on ARM, chosen from what
  the CPU has when the program runs ([Kernels](#kernels)). Android (arm64-v8a, armeabi-v7a,
  x86_64), Linux (x86_64, arm64, armv7) and macOS (Apple silicon, Intel) are tested in CI.
- **int8, int4 and int3 weights.** int8 layers run exactly as TFLite's dynamic-range kernels
  (the Ask reader and writer give TFLite's outputs); language models' matrices in 4-bit
  groups of 32 with float16 scales ([docs/FORMAT.md](/docs/rayo/format/#int4-tensors)), some in
  3-bit groups if asked, or int8, or float32.
- **Weights mapped from the file**, not copied (mmap; `MapViewOfFile` on Windows); a plain
  C89 build (`-DRAYO_NO_PLATFORM`) reads them with fread.
- **Zero allocations per run.** A session plans every activation into one arena when it is
  made (buffers whose lifetimes do not overlap share memory); a run allocates nothing, which
  the tests count.
- **Threads**, the same results bit for bit with any number: one by default, or the CPU's
  fast cores (a phone's big and prime cores, not its little ones).
- **41 ops, and your own**: dense, conv1d, matmul, grouped-query attention, rotary
  embeddings, RMS and layer norms, gather, softmax, reductions, elementwise ops
  ([docs/OPS.md](/docs/rayo/ops/)); ops of your own in C through `include/rayo/op.h`.
- **A converter for TFLite, ONNX and Hugging Face safetensors.** `rayo-convert` (Python,
  NumPy; never TensorFlow or torch) maps the ops, fuses layers, and refuses what rayo cannot
  run, naming the op and why ([docs/CONVERTING.md](/docs/rayo/converting/)).
- **Decoding with a key/value cache.** States kept across runs and size symbols bound per
  run; the converter rewrites a causal transformer to decode token by token.
- **Small language models in little memory.** SmolLM2, Qwen2.5 and other Llama-style
  decoders, with a tokeniser of tokenizer.json (byte-level BPE, Unigram) whose table is read
  from the mapped model file, an int8 key/value cache, a sampler (temperature, top-k, top-p,
  min-p, repetition penalty), a generator and the model's chat template, all in C; a chat
  example for phones and computers: SmolLM2-135M in 15 MB of its own memory at 1000 tokens
  ([docs/RUNNING-SLMS.md](/docs/rayo/small-language-models/)).
- **Dart and Flutter.** `package:rayo` (FFI): models, sessions read and written in place,
  runs in another isolate, the tokeniser and the generator ([Use](#use)).
- **Small.** The Android library is about 171 KB (arm64-v8a), 138 KB (armeabi-v7a) and 190 KB
  (x86_64), stripped, the language-model path included (90, 69 and 98 KB before it); CI fails
  a build over 200 KB.

## Benchmarks

[rayo benchmarks: the Ask reader and writer, and a language model of SmolLM2-135M's shape, on GitHub's x86_64 and arm64 runners (image)](https://raw.githubusercontent.com/pesaclarity/rayo/bench/table-light.png)

Measured again after every push to `main`, on GitHub's ubuntu-24.04 runners (x86_64 and
arm64): Pesa Clarity's Ask reader and writer, and a language model of SmolLM2-135M's shape
with synthetic (random) weights, q4 and int8, on 1 and 2 threads, each a median of several
runs. The same table as text, the history and every run's JSON are on the
[`bench` branch](https://github.com/pesaclarity/rayo/blob/bench/README.md). GitHub-hosted
runners are shared virtual machines, so the numbers are indicative and vary from run to run;
they are not a phone's.

How: the `bench` job (`tool/ci/bench_run.sh`) writes one JSON file a runner; `bench-publish`
adds them, with the Android library sizes, to the `bench` branch (`results/`, `history.csv`,
`README.md`, `table.svg` and the PNGs above, drawn with Chromium), never to `main`, then
screenshots this page on GitHub for the rolling
[`marketing` release](https://github.com/pesaclarity/rayo/releases/tag/marketing). Neither
can fail CI.

## Use

```yaml
dependencies:
  rayo:
    git:
      url: https://github.com/pesaclarity/rayo.git
      ref: v0.1.0
```

```dart
import 'package:rayo/rayo.dart';

final model = RayoModel.load(bytes, sha256: expectedSha256);
final session = RayoSession(model); // keep it for many runs
session.bind('T', 96);
session.inputInt32(0).setAll(0, tokens); // written in place
session.run();
final intent = session.outputFloat32(1); // read in place, until the next run
session.close();
model.close();
```

- `RayoModel.load` / `loadFile` read a model, check its SHA-256 if given, and keep their own
  copy of the bytes. `name`, `metadata`, `inputs` and `outputs` describe it.
- `RayoSession` holds the model's planned memory. Inputs and outputs are views of it: no copy
  in, none out. `bind` sets a size symbol (such as `T`) for the next runs.
- `runInIsolate(session, task)` runs a task on the session in another isolate, so a UI never
  waits. Runs on one session must not overlap.
- `rayoAvailable()` says whether the native library loaded, so an app can fall back.
- Errors (a damaged file, a size that does not fit, an id out of range) throw
  `RayoException`; the C library never aborts on bad input.

From C, include `rayo/rayo.h`: `rayo_model_create` / `rayo_model_destroy`,
`rayo_session_create` / `rayo_session_destroy`, `rayo_session_bind`, `rayo_session_input`,
`rayo_session_run`, `rayo_session_output`, `rayo_session_memory`. Every function documents who
owns what; destroy functions accept NULL.

## Models

A model is a plain-weights file (PCWT) with its graph in the header:
[docs/FORMAT.md](/docs/rayo/format/); its ops are in [docs/OPS.md](/docs/rayo/ops/).
`rayo-convert` writes one from a TFLite or ONNX file ([docs/CONVERTING.md](/docs/rayo/converting/));
Pesa Clarity's are written by [pesaclarity-ml](https://github.com/pesaclarity/pesaclarity-ml)
with it.
`tool/make_test_models.py` (NumPy only) writes the small random models the tests use, with the
outputs NumPy computes.

## Using rayo with your own model

Start from your model's TFLite (or ONNX) file: `rayo-convert` ([docs/CONVERTING.md](/docs/rayo/converting/),
Python, in `convert/`, no TensorFlow) writes the rayo model.

1. **Convert it.**

   ```sh
   pip install ./convert                     # "./convert[onnx]" for ONNX
   rayo-convert my_model.tflite -o my_model.weights
   ```

   It maps every op to rayo's ([docs/OPS.md](/docs/rayo/ops/)), fuses dense layers with their
   bias and activation, 1-D convolutions (dilated ones too, as TFLite writes them) and layer
   norms, keeps int8 weights int8 (run as TFLite's dynamic-range kernels run them), and makes
   a sequence input's length a size symbol `T`. A causal transformer, which the file holds as
   a whole-sequence graph, is rewritten to decode token by token with a key/value cache. It
   prints what it decided, and refuses what rayo cannot run, naming each op, its index and
   why. Options rename and split inputs, pick and order outputs, and turn the rewrites off.

2. **Run it from C.** Load the file, make a session, bind the symbols, write the inputs in
   place, run, read the outputs in place: `rayo_model_create`, `rayo_session_create`,
   `rayo_session_bind(s, "T", n)`, `rayo_session_input`, `rayo_session_run`,
   `rayo_session_output`. A converted decoder runs the prompt with `P = 0, T = n`, then one
   token per run with `T = 1` at `P = n, n + 1, ...`.

3. **Or from Dart**, as in [Use](#use): `RayoModel.load(bytes)`, `RayoSession(model)`,
   `bind('T', ids.length)`, `inputInt32(0).setAll(0, ids)`, `run()`, `outputFloat32(0)`.

`tool/ci/convert.sh` converts Pesa Clarity's released Ask reader and writer
(`tests/ask/*.tflite`) and runs rayo's C tests on them: every reader label as TFLite's, the
writer's next token at all 2243 recorded steps, decoding with its cache (about 1 ms a reply).

**Writing the file by hand.** `examples/classifier` is a model written without a converter:
`make_model.py` writes `classifier.weights` with `tool/pcwt.py` (NumPy only), the tensors and
a graph that names them, and `classify.c` runs it (`classify classifier.weights 4 17 9`,
checked against NumPy in CI by `tool/ci/examples.sh`):

```json
"symbols": {"T": 32},
"inputs": [{"name": "ids", "dtype": "int32", "shape": ["T"]}],
"nodes": [
  {"op": "gather", "inputs": ["embedding", "ids"], "output": "vectors"},
  {"op": "compare", "inputs": ["ids"], "output": "real", "comparison": "greater", "value": 0},
  {"op": "masked_reduce", "inputs": ["vectors", "real"], "output": "mean", "reduction": "mean"},
  {"op": "dense", "inputs": ["mean", "hidden.kernel", "hidden.bias"], "output": "hidden",
   "activation": "relu"},
  {"op": "dense", "inputs": ["hidden", "out.kernel", "out.bias"], "output": "logits"},
  {"op": "softmax", "inputs": ["logits"], "output": "probabilities"}
],
"outputs": [{"name": "probabilities", "node": "probabilities"}]
```

**Ops of your own.** If your graph needs an op rayo does not have, write it in C (`prepare`,
`infer` and `run`; `include/rayo/op.h`) and pass it to `rayo_model_create_with`. See the end
of docs/OPS.md.

**Limits.** These are read from the file:
- the number of nodes, inputs, outputs, states and size symbols;
- a node's inputs, a kernel's size and a convolution's dilation.

Each count is bounded only by overflow checks. The compile-time options are in
`include/rayo/config.h`, with their defaults:
- `RAYO_MAX_RANK`: 4;
- `RAYO_MAX_DIM`: 2^24, the largest dimension;
- `RAYO_ALIGN`: 64;
- `RAYO_JSON_MAX_DEPTH`: 32;
- `RAYO_OP_MAX_INPUTS`: 16, for your own ops.

## Layout

```
include/rayo/     public headers: rayo.h (all of them), config.h (compile-time options),
                  types.h, error.h, tensor.h, model.h, session.h, op.h (your own ops),
                  text.h (tokeniser, sampler), generate.h (text from a language model),
                  sha256.h, version.h
src/core/         allocation, arena, JSON, tensors, messages and formatting, maths, C89 shims
src/format/       the PCWT reader and its checks
src/graph/        the graph, shapes and the memory plan
src/ops/          one file per op family, and the registry
src/kernels/      generic.c, x86.c (SSE4.1/AVX2), x86_vnni.c, neon.c, neon_dotprod.c,
                  quantize.c, select.c (which kernels this CPU runs)
src/platform/     mapped files and their hints, page memory, threads, the CPU's fast cores,
                  the process's memory (POSIX, Win32, or C89)
src/text/         the tokeniser (its table, read in place or built from tokenizer.json), its
                  patterns and Unicode tables, the sampler and the generator
src/model.c, src/session.c, src/sha256/
lib/              the Dart API: bindings/, model.dart, session.dart, isolate_runner.dart, ...
tests/            the C tests (tests/test_*.c), test models, and the real Ask models (tests/ask,
                  with the TFLite files they were converted from)
tools/            bench.c: timing helpers for programs that time a model, op by op
convert/          rayo-convert, TFLite and ONNX models to rayo models (Python), and its tests
examples/         classifier/: a small model of its own, end to end;
                  ask/: Pesa Clarity's reader and writer against TFLite's recordings, timed;
                  chat/: a language model, a conversation or a prompt (make builds it)
```

## Kernels

The int8 and 4-bit products have a generic C version and SIMD ones, each checked against the
generic one in the tests (the 4-bit ones bit for bit):

| Build | Baseline | Chosen at run time when the CPU has it |
| --- | --- | --- |
| Android arm64-v8a | NEON (ARMv8.0) | SDOT dot product (ARMv8.2) |
| Android armeabi-v7a | NEON | |
| Android x86_64 | SSE4.1 | AVX2, AVX-VNNI |
| Linux x86_64 | AVX2 | AVX-VNNI |
| macOS x86_64, any x86 built with gcc or clang | what the flags give | SSE4.1, AVX2, AVX-VNNI |

## Speed

The Ask reader (96 positions, int8, one thread) on one core of a 2.1 GHz Xeon, per question,
with the same machine's TFLite (Python, `num_threads=1`) for comparison:

| | median |
| --- | --- |
| rayo, AVX-VNNI (chosen at run time) | 0.18 ms |
| rayo, AVX2 | 0.34 ms |
| rayo, SSE4.1 (the Android x86_64 baseline) | 0.66 ms |
| rayo, generic C (compiler-vectorised) | 0.80 ms |
| TFLite with XNNPACK | 0.08 ms |
| TFLite built-in kernels | 0.28 ms |

The Ask writer (a 3-layer transformer, int8, word by word with a key/value cache), per reply of
about 13 steps on the 172 recorded replies, the same machine:

| | median |
| --- | --- |
| rayo, AVX-VNNI | 0.89 ms (0.07 ms a step) |
| TFLite with XNNPACK, 1 thread (the whole 64 positions every step, as the app ran it) | 4.1 ms |
| TFLite with XNNPACK, 2 threads | 6.9 ms |
| TFLite built-in kernels | 39 ms |

Every one of the 265 decodes the app's tests make matches the replies TFLite recorded, token
for token, and the next-token choice agrees at every step.

For the reader, loading the model takes about 0.2 ms and making a session about 0.15 ms. Memory: the file's
copy (251 KB), the session's arena (241 KB) and 82 KB of tables. Measured with
`examples/ask/ask_reader_check.c`, which also prints the time per op. Not yet measured on a phone.

## C89

Every C file, the tests' and tools' too, builds with gcc and clang as
`-std=c89 -pedantic -Werror -Wall -Wextra -Wconversion -Wshadow -Wdeclaration-after-statement -Wvla`.

- No `//`, declarations at the top of blocks, no designated initialisers or compound literals,
  no `inline`, `restrict` only as `RAYO_RESTRICT` (`__restrict__` where the compiler has it),
  no `stdint.h` or `stdbool.h`: `include/rayo/types.h` defines `rayo_i8` to `rayo_u32`,
  `rayo_f32` and `rayo_bool`, with compile-time size checks.
- No 64-bit integers: dimensions are `rayo_i32`, byte counts `size_t`, and every tensor stays
  below 2^31 bytes (checked when a model loads and at every bind). SHA-256 counts its length in
  two 32-bit words.
- C89 has no `snprintf`, `expf`, `sqrtf` or `erf`: `src/core/format.c` formats messages
  (bounded), and `src/core/mathx.c` computes exp and sqrt in double, and erf with fdlibm's
  double erf (Sun's permissive licence, `LICENSES/fdlibm.txt`), rounded to float.
  `tool/ci/erf.sh` checks it on every float in [0, 4] against the C library's erf rounded to
  float: it is the same on all 1,082,130,433 of them, monotonic and odd (glibc's own `erff`
  is one ulp off on 6% of them).

## Develop

```sh
dart pub get
tool/check   # what CI runs and this computer can: lint, C tests, sanitisers, Android, Dart
```

`tool/ci/*.sh` are the steps; `tool/check` and `.github/workflows/ci.yml` both call them.

## CI

[`.github/workflows/ci.yml`](https://github.com/pesaclarity/rayo/blob/b7838f6648e8f100674d0e70412c092bb2c6bb6d/.github/workflows/ci.yml) runs on every pull request and push to
`main`: lint (format, C89 with gcc and clang), the C tests on Linux x86_64 (gcc and clang;
generic, SSE4.1 and AVX2 builds, each kernel set, AVX-VNNI where the runner has it), under
ASan, LSan and UBSan, natively on Linux arm64 (NEON, and SDOT where the CPU has it), on
armv7 under QEMU, on macOS arm64, the Android NDK builds with a size budget, and the Dart
package on Linux and macOS. On `main` the bench jobs report the timings in the job summary
and publish the [benchmark table](#benchmarks). The `convert` job runs
rayo-convert's tests and converts the Ask models from TFLite and runs them.

To protect `main`, require these checks: `lint`, `convert`, `linux-x86_64 (gcc)`, `linux-x86_64 (clang)`,
`sanitizers`, `linux-arm64`, `linux-armv7`, `macos (macos-15)`, `macos (macos-15-intel)`,
`android`, `dart (ubuntu-24.04)`, `dart (macos-15)`. The chat example runs a scripted
conversation in the Linux, arm64, armv7 and macOS jobs (`tool/ci/chat.sh`).

Commits follow [Conventional Commits](https://www.conventionalcommits.org/); the changelog is
written from them.

## Licence

GNU Affero General Public License v3.0 (`LICENSE`), like the Pesa Clarity app.
