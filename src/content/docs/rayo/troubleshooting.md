---
title: "Troubleshooting"
description: "What goes wrong most often, what rayo says when it does, and what to do. Every failure comes with a status and a message (msg.text in C, RayoException.message in Dart, which starts with the status's name); the messages…"
section: "rayo"
order: 23
repo: "rayo"
path: "docs/TROUBLESHOOTING.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/TROUBLESHOOTING.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/TROUBLESHOOTING.md"
---
What goes wrong most often, what rayo says when it does, and what to do. Every failure comes
with a status and a message (`msg.text` in C, `RayoException.message` in Dart, which starts
with the status's name); the messages below are rayo's own.

## Building

**`undefined reference to 'expf'` / `'sqrt'` / `'pthread_create'`.** Link the maths library
and, on Linux and Android before API 26, threads: `-lm -lpthread`. Windows and macOS need
neither.

**Different floats from another build of rayo.** Your build fuses multiplies and adds: pass
`-ffp-contract=off` to gcc and clang (clang fuses by default, and with `-mfma` or on arm64
emits FMA instructions). rayo's own builds all pass it; MSVC does not contract by default
([Concepts](/docs/rayo/concepts/#the-same-floats-everywhere)).

**`rayo_session_kernels()` says `generic` on a phone or a recent PC.** The SIMD kernels were
not compiled in: build with optimisation and, for 32-bit ARM, `-mfpu=neon`. With gcc and
clang the x86 kernels need no flag (they are compiled with target attributes and chosen with
`cpuid`); MSVC builds use the generic kernels, and clang-cl the SIMD ones.

**`error: ISO C90 does not support ...` in your own code.** rayo's headers are C89, but your
program can be any C or C++: the `-std=c89 -pedantic` rule is rayo's, not yours.

**A changed limit of `rayo/config.h` gives odd errors.** Define it for rayo *and* for every file
that includes its headers (`RAYO_MAX_RANK` changes `rayo_shape`'s size). The Dart bindings
assume `RAYO_MAX_RANK` 4.

## Dart and Flutter

**`rayoAvailable()` is false, or `Invalid argument(s): Couldn't resolve native function`.**
The build hook did not build the library for this target. It needs Dart 3.10 or Flutter 3.38
or later (code assets and build hooks), and the target's C toolchain: the Android NDK
(Flutter installs it), Xcode on macOS, clang or gcc on Linux. Run `flutter clean`, then build
again and read the hook's output. Windows and the web are not supported by the hook yet
([Roadmap](/docs/rayo/roadmap/)).

**The UI freezes while a model runs.** Run it in another isolate: `runInIsolate(session,
task)`, or `Isolate.run` around the whole generation ([Getting
started](/docs/rayo/getting-started/#dart-and-flutter)). A `RayoGenerator` belongs to the isolate that
made it.

**`StateError: session closed` / `model closed`.** Something used an object after `close()`.
Close in the reverse order of creation, and only when nothing else uses it.

**An output changed under me.** Output views are valid until the next run of their session.
Copy what you keep: `List.of(session.outputFloat32(0))`.

## Loading a model

| Message | Status | Means |
| --- | --- | --- |
| `cannot open PATH` | invalid argument | the file is not there, or the app may not read it (on Android, use the app's files directory, not the assets) |
| `PATH: an empty file or not a file` | format error | a directory, a pipe, or an empty file |
| `not a plain-weights (PCWT) file` | format error | not a rayo model: a `.tflite`, `.onnx` or `.safetensors` file needs `rayo-convert` first |
| `no graph in the header: not a rayo model` | format error | a PCWT file of weights alone, with no graph: write it with rayo-convert |
| `tensor NAME: outside the data or the wrong size` | format error | the file is cut short or damaged: download it again and check its SHA-256 |
| `graph version: rayo reads 1` | unsupported | a file from a newer rayo-convert than this rayo |
| `node NAME: unknown op OP` | unsupported | the graph names an op this rayo does not have: update rayo, or give the op yourself ([OPS.md](/docs/rayo/ops/#ops-of-your-own)) |
| `the model does not match its SHA-256` | integrity check failed | the file is not the one you expected: a damaged or replaced download |
| `the model's signature is not the public key's (Ed25519)` | integrity check failed | the signature was not made with that key, or for this file |
| `N tensors, at most M (RAYO_MAX_TENSORS)` | over a limit | a limit of `rayo/config.h`: raise it for a model that needs more |

## Running

| Message | Status | Means |
| --- | --- | --- |
| `no size symbol NAME` | invalid argument | the graph has no such symbol: see the model's inputs' shapes (`rayo_model_input_info`) |
| `T = 99, it must be 0 to 32` | shape error | a size above the graph's (or the session's limits') largest |
| `node NAME: these sizes need more than planned` | shape error | the bound sizes need more memory than the session planned (its `limits` were lower): plan for more |
| `out of memory for N bytes` | out of memory | the session's arena did not fit: lower the sizes (`limits`, `state_rows`, a generator's `context`), or `RAYO_MAX_ARENA_BYTES` to fail earlier |

## Language models

| Message | Status | Means |
| --- | --- | --- |
| `the model file has no tokeniser table (convert it again, or load its tokenizer.json)` | unsupported | an older file, or converted with `--no-tokenizer-table`: convert it again, or use `rayo_tokenizer_load` / `RayoTokenizer.load` with its `tokenizer.json` |
| `the model has no chat template (convert it with jinja2 installed)` | unsupported | install the converter's `chat` extra (`pip install "./convert[chat]"`) and convert again, or use `prompt` instead of `chat` |
| `the chat template takes no system text` | unsupported | this model's template has no system turn: pass no system text |
| `the context is full: N of M tokens` | shape error | the conversation holds as many tokens as its context: `reset` it, or make the generator with a larger `context` (at most the converter's `--context`) |
| `no prompt yet` | invalid argument | `next` before any `chat` or `prompt` |
| `tokenizer: model WordPiece (BPE and Unigram are read)` | unsupported | a tokeniser kind rayo does not read; decoder-only models ship BPE or Unigram |
| `N bytes of text, at most M (RAYO_MAX_TEXT_BYTES)` | over a limit | one text larger than the limit (16 MiB by default) |

**The replies are gibberish.** Check that the model is an instruct (chat) model, that the
tokeniser is the model's own (the table in the file is), and that the model works at
`--weights int8` before trying q4 or q3. Greedy decoding (`temperature: 0`) on a tiny model
repeats itself: that is the model, not rayo.

**The phone kills the app.** Its own memory ran out. Use the int8 cache (the default in
Dart), a shorter `context`, and map the model instead of loading it: mapped weights are
file-backed, so the system can drop and re-read them instead of killing the app
([Performance](/docs/rayo/performance/#making-it-faster-or-smaller)).

## Converting

rayo-convert refuses what rayo cannot run and says why, naming the op, its index in the
source and the reason, such as `op 12 (DEPTHWISE_CONV_2D, output 'conv'): DEPTHWISE_CONV_2D:
rayo has no depthwise convolution`, one line for each op it cannot convert. The [converter's
guide](/docs/rayo/converting/) lists the ops it maps; anything else needs the model changed (export
it without the op) or an op of your own. `--graph` prints the graph it wrote, to compare with
the source.

## Still stuck

Open an issue at [github.com/pesaclarity/rayo/issues](https://github.com/pesaclarity/rayo/issues)
with the message, the status, the platform, how rayo was built, and (if you can share it) the
model or how it was converted. Security problems go privately, as
[SECURITY.md](/docs/rayo/security/#reporting-a-vulnerability) says.
