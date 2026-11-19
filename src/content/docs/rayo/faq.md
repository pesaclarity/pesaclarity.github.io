---
title: "FAQ"
description: "Running small models on the device, on the CPU, offline: classifiers, readers, small transformers and small language models (about 100M to 1.5B parameters), from C, Dart or Flutter."
section: "rayo"
order: 24
repo: "rayo"
path: "docs/FAQ.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/FAQ.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/FAQ.md"
---
## What is rayo for?

Running small models on the device, on the CPU, offline: classifiers, readers, small
transformers and small language models (about 100M to 1.5B parameters), from C, Dart or
Flutter. Pesa Clarity's question reader and reply writer run on it on phones.

## Does it need a network connection, Google Play services or a GPU?

No. rayo uses the C library and the kernel only: nothing is downloaded at run time, and it
runs on phones with or without Google Play services. It runs on the CPU; there is no GPU or
NPU path.

## Which platforms does it run on?

Android (arm64-v8a, armeabi-v7a, x86_64), iOS (device and simulator), Linux (x86_64, arm64,
armv7), macOS (Apple silicon and Intel) and Windows (MSVC and clang-cl), all built and
tested in CI. `package:rayo`'s build hook covers Android, iOS, macOS and Linux; Windows is a C
build for now ([Roadmap](/docs/rayo/roadmap/)).

## Which models can it run?

Any graph of its 41 ops ([OPS.md](/docs/rayo/ops/)), converted by rayo-convert from TFLite, ONNX or a
Hugging Face Llama-style decoder (SmolLM2, Qwen2.5 and others), or written by hand
([`examples/classifier`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/classifier)). An op it lacks can be added by the program
([OPS.md](/docs/rayo/ops/#ops-of-your-own)).

## Why C89?

So it builds with any C compiler, old or new, on any platform, with no configuration and no
other library, and so F-Droid and anyone else can build it from source offline. The SIMD
code and the system calls are confined to a few files, with plain C fallbacks.

## Are the results deterministic?

Yes. The same model and inputs give the same floats, bit for bit, with every kernel set, any
number of threads, and any compiler and flags that build rayo with `-ffp-contract=off`. A
language model with the same seed gives the same tokens.

## Is it thread-safe?

A model may be shared by any number of sessions on any threads. One session, generator or
sampler is used by one thread at a time; separate ones may run at once.

## How large is it?

About 191 KB for Android arm64-v8a, stripped, with the language-model path and signature
checks. A 135M-parameter chat model in q4 is an 80 MB file and holds about 15 MB of its own
memory in a 1000-token chat.

## How fast is it?

See [Performance](/docs/rayo/performance/) for every number and the machine it came from. No phone
has been measured yet; `tool/bench_phone.sh` measures one.

## How does it compare with TFLite or llama.cpp?

On the Ask reader, one x86 core: rayo with AVX-VNNI takes 0.18 ms, TFLite with XNNPACK 0.08 ms
and TFLite's built-in kernels 0.28 ms; on the Ask writer, rayo decoding with its cache takes
0.89 ms a reply against TFLite's 4.1 ms. rayo's aims are elsewhere: a small library in plain
C, built from source, identical floats everywhere, bounded memory, and untrusted models
handled safely. It does not aim to be the fastest.

## Can I use it in a closed-source app?

Yes, with rayo unmodified or extended through its public API, under the rayo Linking
Exception: see [Licensing](/docs/rayo/licensing/). The exception is a draft awaiting legal review.

## Is it safe to load models downloaded from the internet?

rayo treats every model file and text as untrusted: every size and offset is checked, with
limits on what a file can make it allocate, and it is fuzzed and sanitised in CI. To be sure
a model is the one you published, require its Ed25519 signature
([SECURITY.md](/docs/rayo/security/)).

## Where are the prebuilt libraries?

There are none, on purpose: rayo is compiled from source into your app, by the Dart build
hook or your own build. A prebuilt Android AAR and iOS xcframework are on the
[roadmap](/docs/rayo/roadmap/).
