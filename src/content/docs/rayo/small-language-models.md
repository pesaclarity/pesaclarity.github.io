---
title: "Small language models"
description: "rayo runs decoder-only language models of about 100M to 1.5B parameters on the CPU, offline: the weights mapped from the file in 4-bit groups (some 3-bit if asked), an int8 key/value cache, a few threads on the fast…"
section: "rayo"
order: 15
repo: "rayo"
path: "docs/RUNNING-SLMS.md"
commit: "b7838f6648e8f100674d0e70412c092bb2c6bb6d"
source: "https://github.com/pesaclarity/rayo/blob/b7838f6648e8f100674d0e70412c092bb2c6bb6d/docs/RUNNING-SLMS.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/RUNNING-SLMS.md"
---
rayo runs decoder-only language models of about 100M to 1.5B parameters on the CPU, offline:
the weights mapped from the file in 4-bit groups (some 3-bit if asked), an int8 key/value
cache, a few threads on the fast cores. No GPU, no Google library, nothing downloaded at run time. This page goes from a
Hugging Face model to a chat on an Android phone, then on a computer.

What you need: a computer with `git`, a C compiler, `make` and Python 3.10 or later (for the
converter, which needs NumPy and jinja2 only: no torch, no TensorFlow), and for a phone the
Android NDK and `adb`.

## Models

Models whose licences let you run and ship them, and that rayo-convert reads (Llama-style
decoders):

| Model | Licence | Parameters | q4 file | Memory at 2048 tokens (estimate) |
| --- | --- | --- | --- | --- |
| [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) | Apache-2.0 | 135M | 80 MB | 15 MB of its own, 94 MB in all, at 1000 tokens |
| [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) | Apache-2.0 | 362M | about 210 MB (estimate) | about 20 MB of its own (estimate) |
| [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) | Apache-2.0 | 494M | 282 MB | 13 MB of its own, 297 MB in all, at 1000 tokens |

(The last column is the q4 file with float16 scales and the chat program's defaults: an
int8 cache of 1024 tokens.) The memory is the mapped weights the model reads (all of them,
every token; the system can drop and re-read them) plus the process's own: the cache for
the tokens so far, `2 x layers x kv_heads x (head_dim + 4) bytes` a token with the int8 cache
(SmolLM2-135M: 12.2 KB, Qwen2.5-0.5B: 6.5 KB; float32: `head_dim x 4`, 46 and 24 KB), about
2 MB of working memory and the program. The figures were measured with models of their
shapes and random weights (`tool/make_synthetic_slm.py`); the real files are the same size.
A phone with 2 GB runs the first and the third.

## On an Android phone

Works on any arm64 or armv7 phone with Android 7 or later, with or without Google Play
services (Huawei and HarmonyOS phones, de-Googled ROMs): rayo uses only the C library and the
kernel. It picks NEON, and the ARMv8.2 dot product (SDOT) where the CPU has it, at run time.

1. **Get rayo and the converter** (on your computer):

   ```sh
   git clone https://github.com/pesaclarity/rayo.git && cd rayo
   python3 -m venv .venv && . .venv/bin/activate      # or: uv venv && . .venv/bin/activate
   pip install "./convert[chat]"                       # or: uv pip install "./convert[chat]"
   ```

2. **Download a model** from Hugging Face (about 270 MB for SmolLM2-135M, 1 GB for
   Qwen2.5-0.5B):

   ```sh
   m=HuggingFaceTB/SmolLM2-135M-Instruct              # or Qwen/Qwen2.5-0.5B-Instruct
   mkdir -p models/src && cd models/src
   for f in config.json generation_config.json tokenizer.json tokenizer_config.json \
            model.safetensors; do
     curl -fLO "https://huggingface.co/$m/resolve/main/$f"
   done
   cd ../..
   ```

3. **Convert it** to 4-bit weights:

   ```sh
   rayo-convert models/src -o models/smollm2.weights --weights q4 --context 2048
   ```

   This writes `models/smollm2.weights`, with the tokeniser's table in it, and
   `models/smollm2.tokenizer.json` (for tools; the phone does not need it). The downloaded
   files are no longer needed: `rm -r models/src`. Options: `--scales float32` for the
   larger float32 group scales of earlier files (the default, float16, is 4.5 bits a
   weight); `--q3 mlp` for 3-bit feed-forward matrices (3.5 bits a weight there, a file 20%
   smaller; its quality on real models is not measured yet, see below).

4. **Build the chat program for the phone** with the NDK (`$NDK` is its directory, such as
   `~/Android/Sdk/ndk/28.2.13676358`; `HOST` is `linux-x86_64` or `darwin-x86_64`):

   ```sh
   bin=$NDK/toolchains/llvm/prebuilt/$HOST/bin
   make CC=$bin/aarch64-linux-android24-clang LIBS=-lm                          # arm64
   # 32-bit phones: make CC=$bin/armv7a-linux-androideabi24-clang CFLAGS="-O2 -mfpu=neon" LIBS=-lm
   ```

5. **Copy it over and chat** (USB debugging on):

   ```sh
   adb push examples/chat/chat models/smollm2.weights /data/local/tmp/
   adb shell
   cd /data/local/tmp && chmod +x chat && ./chat smollm2.weights
   ```

   Type a line and press Enter; the reply streams. `/reset` starts again, `/quit` stops, and
   on the way out it prints the prompt and reply speeds and the memory: the process's own
   (private) and the mapped file's resident pages, which Android can drop and read again.

**Threads.** By default the program runs on 2 of the phone's big cores (read from
`/sys/devices/system/cpu/*/cpu_capacity`, or their highest clocks), or 1 where there is only
one: on a low-end phone two cores already use the memory bandwidth decoding needs, and the
others stay free for the app and cooler (`rayo_cpu_default_threads()`). Elsewhere (Linux,
macOS, Windows) the default is the fast cores up to 4, as before. `--threads N` sets it. The
answer is the same with any number of threads, bit for bit.

**Memory.** Two kinds count on a phone. The weights are mapped from the file, so they are
file-backed: Android can drop their pages under pressure and read them again (slower, but
not killed). The process's own memory (private: the key/value cache, the working memory,
the tables) must stay. The chat program keeps the second small:

- **int8 key/value cache** (`--kv int8`, the default; `--kv float32` for the float cache): a
  scale per token and head, a quarter of the memory. For SmolLM2-135M, 12.2 KB a token
  instead of 46 KB.
- **The conversation's context**, 1024 tokens by default (`--context N`, at most the model's
  `--context` from the converter). The cache is sized for this, not for the model's longest.
- **Prompts in chunks** of 32 tokens (`--chunk N`): the working memory is the same for a
  prompt of any length, and so are the outputs.
- **The tokeniser's table**, read from the mapped model file: no tokenizer.json is parsed (a
  large one took tens of MB for a moment).
- The model file is mapped with a sequential read-ahead hint (`madvise`), measured below.

**Other options:** `--temp 0` for greedy replies, `--temp`, `--top-k`, `--top-p`, `--min-p`,
`--repeat-penalty`, `--seed`, `--max-tokens`, `--system "..."`, and `-p "text"` to continue a
raw prompt instead of chatting, `--tokenizer FILE` for a tokenizer.json instead of the table.
The quantisation is chosen when converting (`--weights q4`, `int8` or `float32`, `--scales`,
`--q3`), and the longest context too (`--context`).

### In an app, through Dart

The rayo Dart package builds the same C code into the app (a build hook, from source, so an
F-Droid build has no prebuilt library) and gives the generator to Dart:

```dart
import 'package:rayo/rayo.dart';

final model = RayoModel.map('$dir/smollm2.weights');       // mapped, not copied
final tokenizer = RayoTokenizer.fromModel(model);          // the table in the file
final chat = RayoGenerator(model, tokenizer, temperature: 0.7, maxTokens: 200);
// int8 cache, 1024 tokens, chunks of 32 and 2 threads on Android by default:
// RayoGenerator(..., context: 512, int8Cache: false, threads: 1) to change them.
// RayoProcessMemory.now() reports private and file-backed memory.
chat.chat('How do I save money on transport?');
for (final piece in chat.reply()) {
  // show piece; break (or chat.cancel()) to stop early
}
chat.close(); tokenizer.close(); model.close();
```

Run it in a background isolate (`Isolate.run`, or a long-lived isolate fed through a port) so
the UI never waits: each step is one short native call (a prompt chunk or one token), so
cancelling is just not asking for the next one. Ship the model as a downloaded file or an
asset copied to the app's files directory, since it is mapped from a path.

## On a computer, to try it

### Intel Mac (macOS)

1. Xcode's command line tools give `clang`, `make` and `git` (Homebrew is not needed):

   ```sh
   xcode-select --install
   ```

2. Steps 1 to 3 above (clone, the converter, download, convert).
3. Build and run:

   ```sh
   make
   ./examples/chat/chat models/smollm2.weights
   ```

rayo picks SSE4.1 or AVX2 (and AVX-VNNI) at run time with cpuid, so the same build runs on
every Intel Mac, AVX2 or not. The default threads are the physical cores (`hw.physicalcpu`)
up to 4. Apple silicon Macs build and run the same way, with NEON and the dot product.

### Linux

```sh
sudo apt install build-essential git python3-venv   # or your distribution's equivalent
```

Then steps 1 to 3, `make` and `./examples/chat/chat models/smollm2.weights`, as on a Mac.

### Windows (optional, not yet checked in CI)

With [MSYS2](https://www.msys2.org) (MinGW-w64 shell): `pacman -S make mingw-w64-x86_64-gcc
python`, then `make LIBS=-lm` and the same steps. The file is mapped with `MapViewOfFile` and
the threads are Win32 threads.

## What to expect

Measured on a 2.1 GHz Xeon (x86_64, AVX-VNNI, 4 cores shared with other work, so the speeds
are noisy, two threads especially) with models of the real shapes, random weights and a
synthetic tokeniser of the real vocabulary's size (`tool/make_synthetic_slm.py --tokenizer`).
No phone has been measured yet: please send numbers from a real phone (`./chat` prints them
on the way out). Under QEMU the chat program runs on arm64 (SDOT) and armv7 (NEON) with every
weight type and both caches; QEMU's times are not a phone's.

**A long chat** (`examples/chat`, 2 threads, 8 to 12 turns of 64-token replies until about
1000 tokens are in the context), SmolLM2-135M shape. Private is the process's own memory at
its peak (smaps_rollup's Anonymous); total is the peak RSS, which adds the mapped file's
resident pages.

| Weights, cache | File | Private | Total (RSS) |
| --- | --- | --- | --- |
| before this change: q4 float32 scales, float32 cache for 2048, tokenizer.json | 84 MB + 2 MB JSON | 62 MB | 145 MB |
| q4 float32 scales, float32 cache (1024) | 89 MB | 46.5 MB | 133 MB |
| q4 float32 scales, int8 cache | 89 MB | 15.1 MB | 102 MB |
| q4 float16 scales, float32 cache | 80 MB | 46.5 MB | 125 MB |
| **q4 float16 scales, int8 cache (the defaults)** | **80 MB** | **15.1 MB** | **94 MB** |
| q4 and q3 (`--q3 mlp`), float16 scales, int8 cache | 70 MB | 15.1 MB | 84 MB |
| Qwen2.5-0.5B shape, q4 float16 scales, int8 cache | 282 MB | 13.4 MB | 297 MB |

The files include the tokeniser's table: 4.5 MB for a 49152-token vocabulary, 17 MB for
Qwen2.5's 151936, read where they are. The weights alone are 84, 76 and 66 MB.

**Speed** (`tools/slm_bench.c`: 128 prompt tokens, then 64 decoded; medians of five runs):

| Weights, cache | Prompt tokens/s, 1 / 2 threads | Reply tokens/s, 1 / 2 threads |
| --- | --- | --- |
| before: q4 float32 scales, float32 cache, chunks of 64 | 128 / 96 | 37 / 30 |
| q4 float32 scales, float32 cache | 113 / 109 | 36 / 33 |
| q4 float32 scales, int8 cache | 100 / 124 | 34 / 32 |
| q4 float16 scales, float32 cache | 119 / 115 | 30 / 28 |
| q4 float16 scales, int8 cache | 101 / 112 | 30 / 29 |
| q4 and q3, float16 scales, int8 cache | 109 / 101 | 32 / 29 |
| Qwen2.5-0.5B shape, q4 float16 scales, int8 cache | 43 / 67 | 9.5 / 16.7 |

On this x86 core, which has memory bandwidth to spare, float16 scales cost about 15% of the
reply speed (their conversion, done a row at a time with SIMD); on a phone, where decoding
waits on memory, their 10% smaller reads are expected to matter more. That is to be
measured. The int8 cache costs little at these lengths.

**When memory is short.** With the chat program in a memory cgroup (cgroup v1
`memory.limit_in_bytes`, which counts the page cache) of 64 MB and of 48 MB, below the
80 MB file, the 1000-token chat still finishes (q4 float16 scales, int8 cache): private
memory stays at 15 MB, the system drops and re-reads the weights' pages, and replies slow
from about 30 to 9 tokens a second. Nothing is killed. The read-ahead hints, decoding
tokens/s with 2 threads (three runs each):

| Hint | 64 MB | 48 MB |
| --- | --- | --- |
| none (`normal`) | 8.6, 8.4, 6.0 | 8.8, 8.6, 9.2 |
| `sequential` | 6.6, 7.1, 6.7 | 7.7, 7.2, 7.4 |
| `willneed` (the default) | 8.4, 8.7, 8.7 | 8.8, 7.9, 9.4 |

`MADV_SEQUENTIAL` drops pages behind the reader, which a decoder reads again next token;
`MADV_WILLNEED` reads ahead and is the steadiest, so it is the default
(`rayo_model_options.access`). With no limit the hints change nothing measurable.

**Quality.** The real weights could not be downloaded here, so quality on real models is
not measured. On synthetic matrices (SmolLM2's 1536 x 576 feed-forward shape) the error of
the dequantised weights against float32, as a fraction of their root mean square:

| | Gaussian weights | Heavier-tailed weights (Student-t, 4 degrees) |
| --- | --- | --- |
| q4, float32 scales | 0.086 | 0.115 |
| q4, float16 scales | 0.086 | 0.115 |
| q3 (scale searched per group), float16 scales | 0.164 | 0.211 |

float16 scales change nothing that matters; 3 bits double the error, so measure a real
model's agreement with float32 before shipping `--q3`. The int8 cache keeps the tiny test
model's logits within 1% of the float32 cache's (3% on random 128-wide weights), with the
same most likely token.

Earlier numbers (the spike, before this change; one Xeon core, 2048-token cache):

| Model, weights | File | Peak memory | Prompt tokens/s (1 / 2 / 4 threads) | Reply tokens/s (1 / 2 / 4 threads) |
| --- | --- | --- | --- | --- |
| SmolLM2-135M shape, int8 | 129 MB | 146 MB | 258 / 309 / 350 | 51 / 81 / 56 |
| SmolLM2-135M shape, float32 | 513 MB | 528 MB | 46 / 127 / 202 | 18 / 28 / 38 |
| Qwen2.5-0.5B shape, int8 | 473 MB | 491 MB | 82 / 135 / 225 | 18 / 28 / 32 |
