---
title: "Performance and benchmarks"
description: "Every number rayo publishes says what it was measured on. This page lists the sources, the programs that measure them, how to measure a phone yourself, and what to change when a model is too slow or too large."
section: "rayo"
order: 20
repo: "rayo"
path: "docs/PERFORMANCE.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/PERFORMANCE.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/PERFORMANCE.md"
---
Every number rayo publishes says what it was measured on. This page lists the sources, the
programs that measure them, how to measure a phone yourself, and what to change when a model
is too slow or too large.

> [!IMPORTANT]
> No phone has been measured yet. The numbers below come from a server CPU and from
> GitHub's shared virtual machines; a phone's will be lower, and decoding on a phone is
> expected to wait on memory more than on arithmetic. The steps to measure one are
> [below](#measuring-an-android-phone), and results are welcome.

## Where the numbers come from

| Source | Hardware | What | Where |
| --- | --- | --- | --- |
| Every push to `main` | GitHub's `ubuntu-24.04` runner: x86_64, shared virtual machine, the CPU varies by run | the Ask reader and writer; a language model of SmolLM2-135M's shape with random weights, q4 and int8, 1 and 2 threads; medians of several runs | the README's table, and the [`bench` branch](https://github.com/pesaclarity/rayo/blob/bench/README.md) with every run's JSON |
| Every push to `main` | GitHub's `ubuntu-24.04-arm` runner: arm64, shared virtual machine | the same | the same |
| Every pull request | both runners, the base and the head built and run in turn on one machine | the same programs, before and after | the `bench-compare` job's summary |
| By hand, once | one core of a 2.1 GHz Xeon (x86_64, AVX-VNNI), shared with other work | the Ask reader and writer against TFLite on the same machine; language-model shapes with random weights | the README's [Speed](/docs/rayo/overview/#speed) and [RUNNING-SLMS.md](/docs/rayo/small-language-models/#what-to-expect) |
| **A phone** | **coming**: a 2 GB Android Go phone first | `tool/bench_phone.sh` | this page and the README, once measured |

GitHub-hosted runners are shared virtual machines: their numbers are indicative and vary
from run to run, and they are not a phone's. The language-model numbers use random weights
of the real shapes (`tool/make_synthetic_slm.py`), so the speed and memory are the real
model's while the text means nothing.

## The programs

| Program | Measures |
| --- | --- |
| [`tools/slm_bench.c`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/tools/slm_bench.c) | a decoder: model load time, prompt (prefill) and decode tokens a second, peak private, mapped-file and resident memory; `--runs N` for medians, `--json FILE` for a report |
| [`examples/ask/ask_reader_check.c`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/ask/ask_reader_check.c) | the Ask reader: per question, load and session times, memory, time per op |
| [`examples/ask/ask_writer_bench.c`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/ask/ask_writer_bench.c) | the Ask writer: per reply and per step, with the key/value cache |
| [`examples/chat/chat.c`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/chat/chat.c) | a real chat: prints prompt and reply speeds and the memory on the way out |
| `tool/ci/bench_run.sh` | the README table's numbers on this computer (JSON) |
| `tool/ci/bench_compare.sh BASE_SHA` | a branch against its base, on this computer |

`slm_bench` on a computer:

```sh
cc -std=c89 -O2 -ffp-contract=off -Iinclude -Isrc -Itools $(find src -name '*.c') \
  tools/bench.c tools/slm_bench.c -lm -lpthread -o slm_bench
python3 tool/make_synthetic_slm.py smollm2-135m q4 /tmp/slm.weights
./slm_bench /tmp/slm.weights 128 64 2 --runs 5 --json result.json
```

The JSON has `model_load_ms` (mapping and checking the file), `session_ms` (planning the
session), `prefill_tok_s` and `decode_tok_s` (medians, with every run's in
`prefill_tok_s_runs` and `decode_tok_s_runs`), `peak_rss_mb`, `peak_private_mb`,
`peak_file_resident_mb`, and the kernels, threads, cache, context and chunk it ran with.

## Measuring an Android phone

`tool/bench_phone.sh` builds `slm_bench` with the NDK for the phone's ABI (arm64-v8a, or
armeabi-v7a, which many Android Go phones run even on 64-bit chips), pushes it and the model
over adb, runs it for each thread count and writes one JSON file with the phone's details
(model, Android version, ABI, `ro.config.low_ram`, memory, cores and their clocks, battery
level and temperature) and every run.

The steps for a **2 GB Android Go phone**:

1. **On a computer:** `git`, Python 3, `adb` (Android platform-tools) and the Android NDK
   (r26 or later):

   ```sh
   git clone https://github.com/pesaclarity/rayo.git && cd rayo
   export ANDROID_NDK_HOME=~/Android/Sdk/ndk/28.2.13676358     # yours
   ```

2. **The model:** the release's `smollm2-135m-instruct-q4.weights` (about 80 MB), checked
   against its SHA-256:

   ```sh
   gh release download v0.1.0 -R pesaclarity/rayo -p 'smollm2-135m-instruct-q4.*'
   sha256sum -c smollm2-135m-instruct-q4.weights.sha256
   ```

   Or convert it yourself ([RUNNING-SLMS.md](/docs/rayo/small-language-models/#on-an-android-phone)).

3. **The phone:** Settings, About phone, tap *Build number* seven times; then Developer
   options, *USB debugging* on. Connect it and accept the prompt; `adb devices` lists it.
   For steady numbers: charge it above 80%, close other apps, turn on airplane mode, leave
   the screen on, and let it cool for five minutes if it is warm.

4. **Run it:**

   ```sh
   tool/bench_phone.sh smollm2-135m-instruct-q4.weights \
     --label "Phone name, Android 11 (Go edition), 2 GB" --threads "1 2" --runs 5
   ```

   It prints a table and writes `bench-phone/phone-<time>.json`. The defaults are a
   128-token prompt, 64 decoded tokens, the int8 cache and a 1024-token context, as the chat
   program runs; `--context 512` halves the cache, and `--kv float32` measures the float
   cache.

5. **A real chat**, to see it work and its memory under the system's pressure: build the chat
   program for the phone and talk to it ([RUNNING-SLMS.md](/docs/rayo/small-language-models/#on-an-android-phone),
   step 4 and 5). It prints the speeds and memory when you `/quit`.

6. **Report it:** open an issue with the JSON file, or add it to the README's benchmark
   table in a pull request, with the phone's name.

> [!TIP]
> If the phone kills the program, it ran out of memory: try `--context 512`, close other
> apps, and check `adb shell dumpsys meminfo` for what else is resident. The mapped weights
> can be dropped and read again by the system, so a model larger than free memory still
> runs, more slowly.

## Making it faster or smaller

| To | Change |
| --- | --- |
| Use the right kernels | build with optimisation (`-O2`), and check `rayo_session_kernels()`: `generic` on a phone means NEON was not enabled (`-mfpu=neon` for armeabi-v7a) |
| Use more cores | `threads = -1` (the fast cores) in C, or `threads:` in Dart; on phones more than 2 rarely helps decoding, which waits on memory |
| Hold less memory | the int8 key/value cache (`RAYO_CACHE_INT8`, the generator's default in Dart); a shorter `context`; `RAYO_MAX_ARENA_BYTES` to fail early instead of being killed |
| Ship a smaller file | q4 with float16 scales (the default); `--q3 mlp` for 3-bit feed-forward matrices, 20% smaller (measure the quality first) |
| Keep the UI smooth | run models in a background isolate (Dart) or thread (C); a generator's steps are short, so a UI can cancel between them |
| Start faster | map the model (`rayo_model_load`, `RayoModel.map`) instead of reading it; keep the session for many runs |

The library itself is small: about 191 KB stripped for Android arm64-v8a, with the
language-model path; CI fails a build over 200 KB.
