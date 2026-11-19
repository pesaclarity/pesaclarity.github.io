---
title: "Concepts"
description: "rayo has few moving parts: a model (a file's weights and graph), sessions that run it, and for language models a tokeniser, a sampler and a generator."
section: "rayo"
order: 13
repo: "rayo"
path: "docs/CONCEPTS.md"
commit: "1e536df33c3d0a50b180b7431be52ed9838ebff2"
source: "https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/docs/CONCEPTS.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/CONCEPTS.md"
---
rayo has few moving parts: a **model** (a file's weights and graph), **sessions** that run
it, and for language models a **tokeniser**, a **sampler** and a **generator**. This page
explains each, then the file format, quantisation, kernels, threads and memory, in the terms
the [C](/docs/rayo/c-api/) and [Dart](/docs/rayo/dart-api/) APIs use.

## Models

A model is one file: a plain-weights (PCWT) file whose JSON header holds the tensors' names,
types, shapes and offsets, and a `graph` of rayo's ops that runs them
([FORMAT.md](/docs/rayo/format/), [OPS.md](/docs/rayo/ops/)). `rayo-convert` writes one from TFLite, ONNX or a
Hugging Face language model ([CONVERTING.md](/docs/rayo/converting/)).

There are two ways to open one:

| | C | Dart | The weights |
| --- | --- | --- | --- |
| **Map the file** | `rayo_model_load` | `RayoModel.map` | used where they are in the file (mmap, `MapViewOfFile`); the system reads pages as a run touches them and may drop them under memory pressure. The way to open a language model. |
| **From bytes** | `rayo_model_create`, `rayo_model_create_with` | `RayoModel.load`, `RayoModel.loadFile` | copied: rayo keeps its own copy, and the caller may free the bytes when the call returns. For small models, assets and bytes from the network. |

A model describes itself: its `name`, its `metadata` (any JSON object the converter wrote:
labels, the chat template, the source and licence), and its inputs and outputs, each with a
name, a dtype and its **largest** shape. The model is read-only once loaded and may be shared
by any number of sessions, on any threads. Destroy its sessions first, then the model.

Every model file is untrusted input: every size and offset is checked before it is used, and
a damaged file gives an error, never a crash ([SECURITY.md](/docs/rayo/security/)). A model can also be
required to match a SHA-256 or an Ed25519 signature before rayo reads any of it
([Requiring signed models](/docs/rayo/security/#requiring-signed-models)).

## Sessions

A session runs a model. When it is created it plans all the memory a run can need, for the
largest sizes the graph allows, in one allocation (the **arena**): buffers whose lifetimes
do not overlap share memory. After that, **a run allocates nothing**, which rayo's tests
count.

Inputs and outputs are views of that arena (`rayo_tensor_view` in C, typed lists in Dart):
you write an input in place and read an output in place, with no copy in or out. An output
stays valid until the next run on the same session.

- One session runs on **one thread at a time**. Separate sessions of one model may run at
  once, on different threads.
- Make a session once and keep it: creating one plans memory, running one does not.
- `rayo_session_reset` zeroes its states, to start a new sequence.

## Size symbols

A graph's shapes may name **size symbols**, such as `T` (a sequence's length) or `P` (the
positions a decoder has already seen). The file gives each symbol's largest value; a session
plans for those. Before a run, bind each symbol to its value for the next runs
(`rayo_session_bind(session, "T", n, &msg)`, `session.bind('T', n)`). Inputs and outputs then
have the bound shapes, and a value above the largest is a `RAYO_ERR_SHAPE`.

A session can also be planned for less than the file allows, to save memory:
`rayo_session_options.limits` lowers a symbol's largest value and the size its memory is
planned for, and `state_rows` caps the rows of each state ([C API](/docs/rayo/c-api/#rayo_session_create_with)).

## States and decoding

A graph may declare **states**: tensors a session keeps from one run to the next, such as a
decoder's key/value cache. A converted decoder runs a prompt of `n` tokens with `P = 0,
T = n`, then one token per run with `T = 1` at `P = n`, `n + 1`, and so on; its output is the
last position's logits. `rayo_session_reset` empties the states for a new sequence.

The key/value cache can be kept in float32 (as the graph declares it) or in **int8** with a
float32 scale per token and head, a quarter of the memory (`RAYO_CACHE_INT8`). Attention's
outputs then differ from float32's by the rounding of the keys and values.

## Language models: tokeniser, sampler, generator

For text, rayo adds three objects ([`rayo/text.h`](https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/include/rayo/text.h),
[`rayo/generate.h`](https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/include/rayo/generate.h)):

- A **tokeniser** turns UTF-8 text into token ids and ids back into bytes. It reads the
  `tokenizer.json` of a Hugging Face model (byte-level BPE, SentencePiece-style BPE with
  byte fallback, or Unigram) or, better, the **table** rayo-convert writes into the model
  file, read in place from the mapped file with nothing parsed (`rayo_tokenizer_from_model`).
- A **sampler** picks the next token from logits: greedy, or temperature, top-k, top-p, min-p
  and a repetition penalty, from a seed (the same seed and inputs give the same tokens). It
  holds its own memory; picking a token allocates nothing.
- A **generator** joins a decoder's session, its tokeniser and a sampler, and keeps the
  key/value cache across calls, so a chat goes on where it left off. `chat` adds a user's
  turn in the model's own chat template (from its metadata), `prompt` adds raw text, and
  `next` gives one token at a time. Each call does a bounded amount of work (a prompt chunk
  or one token), so a caller cancels by not calling again.

The generator sizes the cache for its `context` (1024 tokens by default, at most the
converter's `--context`) and its working memory for a `chunk` of prompt tokens (32 by
default), whatever the prompt's length; the outputs do not depend on the chunk.

## The weights format

A rayo model is a PCWT file, version 1:

```
"PCWT" | uint32 version (1) | uint32 header length H | UTF-8 JSON header (H bytes) | tensors
```

All little-endian. The header lists every tensor (`float32`, `int8`, `int4` or `int3`, with
its quantisation), the `graph` (inputs, nodes, outputs, symbols, states, a memory plan), an
optional `metadata` object and an optional tokeniser table. Tensors are aligned to
`RAYO_ALIGN` (64 bytes) so the SIMD kernels read them where they are, from the mapped file.
[FORMAT.md](/docs/rayo/format/) has every field; `tool/pcwt.py` writes one with NumPy alone, as
[`examples/classifier`](https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/examples/classifier) does by hand.

## Quantisation

| Weights | Bits a weight | How | Written by |
| --- | --- | --- | --- |
| `float32` | 32 | as trained | `--weights float32` |
| `int8` | 8 | one scale per output channel; activations quantised per row at run time, as TFLite's dynamic-range kernels | TFLite's int8 models as they are; `--weights int8` |
| `int4` (q4) | 4.5 | groups of 32 along the inner dimension, a float16 (or float32) scale each | `--weights q4` (language models), `--scales` |
| `int3` (q3) | 3.5 | groups of 32, the scale searched per group | `--q3 ROLES`, such as `--q3 mlp` |

int8 layers give TFLite's outputs (Pesa Clarity's Ask reader and writer are checked against
TFLite's at every recorded step). For language models, q4 with float16 scales is the default;
3-bit groups make a file about 20% smaller and roughly double the weights' error, so measure
a real model's agreement before shipping them ([RUNNING-SLMS.md](/docs/rayo/small-language-models/#what-to-expect)).

## Kernels

The heavy products (int8, 4-bit and 3-bit weights by int8 activations) have a generic C
version and SIMD ones; float32 products are generic C, vectorised by the compiler. rayo picks
the best kernels the CPU has **when the program runs**, so one build serves every CPU of its
architecture:

| Kernel set (`rayo_session_kernels`) | CPU |
| --- | --- |
| `generic` | any: plain C, vectorised by the compiler |
| `sse4.1`, `avx2`, `avx-vnni` | x86 and x86_64 |
| `neon` | ARMv7 with NEON, and every arm64 CPU |
| `neon-dotprod` | ARMv8.2's dot product (SDOT), most phones since 2018 |
| `neon-i8mm` | ARMv8.6's int8 matrix multiply (SMMLA), for int8 |

Every SIMD kernel is checked against the generic one in the tests, bit for bit.

## The same floats everywhere

A model gives the same output floats, bit for bit, with every kernel set, with any number of
threads, and with whatever compiler and flags built rayo. Two rules make it so:

- No kernel fuses a multiply and an add (no FMA instruction, no `fma()`), and the SIMD
  kernels add in the order the generic C does.
- rayo is always compiled with **`-ffp-contract=off`**, so no compiler fuses them on its own.
  If you compile `src/` with a build of your own, pass it too (MSVC does not contract by
  default).

`tool/ci/builds.sh` checks it in CI: `gcc -O2` and `clang -O3 -mavx2 -mfma` builds give the
same bits for every test model.

## Threads

A session runs on one thread by default. `rayo_session_options.threads` sets how many a run
uses, the caller's included: `0` or `1` for one, `-1` for `rayo_cpu_fast_cores()`, or a
number. Work is split by output, never within a sum, so **the results are the same with any
number of threads**.

`rayo_cpu_fast_cores()` counts the cores worth running on: a phone's big and prime cores (from
`/sys`), a Mac's performance cores. A language model's default, `rayo_cpu_default_threads()`,
is at most 2 of the fast cores on Android (two already use the memory bandwidth a low-end
phone has for decoding, and leave the others to the app) and at most 4 elsewhere.

In Dart, `RayoGenerator(threads: ...)` sets it for language models; `RayoSession` runs on one
thread.

## Memory

`rayo_model_memory` and `rayo_session_memory` (`model.memory`, `session.memory` in Dart) say
what rayo holds:

| Field | |
| --- | --- |
| `weights` | the model's file (copied, or mapped) and packed weights |
| `arena` | a session's activations, states and scratch, planned once |
| `overhead` | bookkeeping: the graph, plans and tables |
| `states` | of `arena`: the states (a decoder's key/value cache), in full |

On a phone two kinds of memory count. **Mapped weights are file-backed**: the system can drop
their pages under pressure and read them again, so a model costs what a run touches and is
not killed for its size. **Private memory** (the arena, the cache, the tables) must stay.
`rayo_process_memory` (`RayoProcessMemory.now()`) reports both for the whole process, as the
system counts them. A 135M-parameter chat model in q4 with the int8 cache holds about 15 MB of
private memory at 1000 tokens, and maps an 80 MB file ([RUNNING-SLMS.md](/docs/rayo/small-language-models/)).

## Errors and ownership

Every function that can fail returns a `rayo_status` and takes an optional `rayo_message *`
(256 bytes) for a human-readable reason; pass `NULL` to skip it. `rayo_status_str` names a
status. rayo never aborts and never prints. In Dart, a failure throws a `RayoException`
carrying the status and the message.

| Status | Means |
| --- | --- |
| `RAYO_OK` | success |
| `RAYO_ERR_INVALID_ARGUMENT` | a null pointer, an index out of range, a file that cannot be opened |
| `RAYO_ERR_FORMAT` | the model file (or tokeniser) is damaged, or not one |
| `RAYO_ERR_UNSUPPORTED` | a version, op or dtype this rayo does not run |
| `RAYO_ERR_OUT_OF_MEMORY` | an allocation failed |
| `RAYO_ERR_SHAPE` | sizes that do not fit the graph, or a full context |
| `RAYO_ERR_LIMIT` | more than a limit of `rayo/config.h` allows; the message names the limit |
| `RAYO_ERR_INTEGRITY` | the bytes do not match their SHA-256 or signature |

Ownership is always the same: an object made by `rayo_x_create` (or `_load`) belongs to the
caller, who frees it with `rayo_x_destroy`; every destroy function accepts `NULL`. Strings
and views returned by an object belong to that object and live as long as it does (an output
view, until the next run). Destroy in the reverse order of creation: generator, sampler,
tokeniser, session, model.

## Compile-time options

[`include/rayo/config.h`](https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/include/rayo/config.h) holds rayo's compile-time options, each
with its default: the most dimensions a tensor may have (`RAYO_MAX_RANK`, 4, which the Dart
bindings assume), the alignment (`RAYO_ALIGN`, 64), and the limits on what one file or text
may make rayo allocate or compute (`RAYO_MAX_HEADER_BYTES`, `RAYO_MAX_TENSORS`,
`RAYO_MAX_NODES`, `RAYO_MAX_ARENA_BYTES`, `RAYO_MAX_VOCAB`, `RAYO_MAX_TEXT_BYTES`, and
others). Define one when building rayo and every program that includes its headers, such as
`-DRAYO_MAX_ARENA_BYTES=268435456` to fail early on a phone. Other build macros:
`RAYO_NO_PLATFORM` (no system headers: `fread`, one thread) and `RAYO_NO_THREADS` (no
threads).
