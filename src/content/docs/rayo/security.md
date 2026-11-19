---
title: "Security"
description: "rayo runs model files and text it did not write: models bundled with an app now, models downloaded over the air later, and whatever a user types."
section: "rayo"
order: 21
repo: "rayo"
path: "docs/SECURITY.md"
commit: "1e536df33c3d0a50b180b7431be52ed9838ebff2"
source: "https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/docs/SECURITY.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/SECURITY.md"
---
rayo runs model files and text it did not write: models bundled with an app now, models
downloaded over the air later, and whatever a user types. This page says what rayo assumes,
what it guarantees for any input, what it does not, how to require signed models, and how
all of it is checked.

## Threat model

**Untrusted**, possibly written by an attacker, any bytes and any length:

- model files (PCWT, docs/FORMAT.md): the header's JSON, every tensor's offset, size, shape
  and dtype, the graph (nodes, references, symbols, plans, attributes), the tokeniser's table
  in the data;
- tokenizer.json files (`rayo_tokenizer_create`, `rayo_tokenizer_load`) and tokeniser tables
  (`rayo_tokenizer_create_table`);
- text given to `rayo_tokenizer_encode` and the generator: invalid UTF-8, NULs, huge words;
- the values written into a session's inputs, such as token ids out of the vocabulary.

**Trusted**: the program that calls rayo (pointers and sizes it passes are what they say),
ops of the program's own (`rayo/op.h`), the operating system, the C library and the compiler;
and, for a mapped model, that no other process changes the file while it is mapped (below).

## What rayo guarantees, whatever the input

- **No out-of-bounds reads or writes, no undefined behaviour.** Every offset, size and count a
  file gives is checked before it is used, with arithmetic that cannot overflow, on 32-bit
  systems too (`armeabi-v7a`): tensors and their scales lie inside the data, every element
  count and its bytes stay below 2^31, a session's plan stays below `RAYO_MAX_ARENA_BYTES`,
  a node reads only inputs, states, weights and *earlier* nodes (so a graph has no cycles),
  attributes are in their ranges, and every table record, string and id of a tokeniser is
  inside its table. A token id out of range fails the run (`RAYO_ERR_SHAPE`).
- **No unbounded allocation or work.** What one file or text can make rayo allocate or
  compute is bounded by the limits below, checked before the allocation. Name lookups are
  hashed (no quadratic scans of large graphs), BPE merges in O(n log n) however long a word,
  and a tokeniser's patterns run on a budget of steps, so a pattern that backtracks
  catastrophically ends in an error, not in minutes.
- **Typed errors, never a crash.** Untrusted input never reaches an `assert` or `abort`: every
  failure is a status and a message. A run of a session allocates nothing.

  | Status | |
  | --- | --- |
  | `RAYO_ERR_FORMAT` | the file is damaged, or not one: a size, offset, id or string that does not fit, JSON that is not, text that is not UTF-8 |
  | `RAYO_ERR_UNSUPPORTED` | a version, op, dtype or pattern rayo does not read |
  | `RAYO_ERR_SHAPE` | sizes that do not fit the graph, an id out of range at run time |
  | `RAYO_ERR_LIMIT` | more than a limit of `include/rayo/config.h` allows |
  | `RAYO_ERR_INTEGRITY` | the bytes do not match their SHA-256 or signature (below) |
  | `RAYO_ERR_OUT_OF_MEMORY` | the system had no memory for something within the limits |

- **No code execution from data.** rayo has no interpreter, JIT, `dlopen` or function pointer
  taken from a file: a node's op is looked up by name among the built-in ops and the
  program's own. Model files are mapped `PROT_READ` and `MAP_PRIVATE` (Windows: `PAGE_READONLY`),
  activations live in `PROT_READ | PROT_WRITE` pages, and no memory is ever both writable and
  executable. A mapped file is opened read-only with `O_CLOEXEC`, and only a regular file is
  mapped.
- **Hardened builds.** Every library and program CI builds but the fuzz targets, and the Dart
  build hook's library: `-fstack-protector-strong`,
  `-D_FORTIFY_SOURCE=2`, `-Wformat -Wformat-security`; shared libraries are position-independent
  and linked with `-z relro -z now -z noexecstack`. `tool/ci/elf_check.sh` checks the Android
  libraries and the hook's Linux library with readelf (RELRO, BIND_NOW, no text relocations, a
  stack that cannot be executed, no writable and executable segment, canaries, fortify).

## Limits

Compile-time options of `include/rayo/config.h`, each with its default. Define one when
building rayo (and every program including its headers) to change it, such as
`-DRAYO_MAX_ARENA_BYTES=536870912` to fail early on a small phone.

| Limit | Default | Bounds |
| --- | --- | --- |
| `RAYO_MAX_HEADER_BYTES` | 64 MiB | a model's JSON header |
| `RAYO_MAX_HEADER_VALUES` | 2^20 | values in it (the parse costs about 100 bytes each) |
| `RAYO_JSON_MAX_DEPTH` | 32 | nesting (the parser's recursion) |
| `RAYO_MAX_TENSORS` | 16384 | tensors in a file |
| `RAYO_MAX_NODES` | 8192 | nodes, and inputs, states and outputs, of a graph |
| `RAYO_MAX_SYMBOLS` | 64 | size symbols |
| `RAYO_MAX_DIM` | 2^24 | a dimension, a symbol's largest value, a size attribute |
| `RAYO_MAX_ARENA_BYTES` | 2 GiB - 1 | a session's planned activations, states and scratch |
| `RAYO_MAX_TOKENIZER_JSON_BYTES` | 64 MiB | a tokenizer.json |
| `RAYO_MAX_TOKENIZER_JSON_VALUES` | 2^23 | values in it |
| `RAYO_MAX_VOCAB` | 2^22 | a vocabulary (and its largest id must fit the file's entries) |
| `RAYO_MAX_TEXT_BYTES` | 16 MiB | a text to encode, and its normalised form |
| `RAYO_MAX_PATTERN_BYTES` | 4096 | a pre-tokeniser's pattern (and 16 nested groups) |
| `RAYO_PATTERN_STEPS` | 4096 | the matcher's steps a code point of text |

A model within the limits can still be large: a session of a file whose plan is 2 GiB asks
for 2 GiB. `rayo_session_memory` (and the Dart `memory` getters) says what a model and a
session take, so an app can refuse a model that wants more than the phone has.

## What rayo does not guarantee

- **What a model says.** A well-formed model can be wrong, biased, or written to mislead: its
  outputs, and a language model's text, are untrusted data for the app. A signature proves
  who published a model, not that it is good.
- **Side channels.** Inference and tokenisation take time and touch memory depending on the
  data (the tokens, the text); rayo does not hide this from other code on the device. The
  signature check works on public data only, so its timing reveals nothing secret.
- **A mapped file that changes.** `rayo_model_load` maps the file: another process that can
  write it could change pages after rayo checked them, or truncate it (a `SIGBUS` on the next
  read). Keep models in the app's private storage. For bytes that cannot change after the
  check, read the file into memory (`rayo_model_options.read_file`, or `RayoModel.load` /
  `loadFile` in Dart): rayo then checks and uses its own copy.
- **The program's own mistakes**: wrong pointers or sizes passed to the API, ops of its own,
  sessions used from two threads at once.
- **Freedom from older signed models.** A signature does not say a model is the latest:
  to refuse a downgrade, sign a manifest with each model's SHA-256 and version, and check
  the SHA-256 too.

## Requiring signed models

rayo checks a file's SHA-256 and its Ed25519 signature (RFC 8032, "pure" Ed25519 over the
whole file) with its own SHA-256, SHA-512 and Ed25519 (Daniel Beer's public-domain c25519,
`LICENSES/c25519.txt`), before it parses a byte of the file. No other library is needed.

**Publishing.** Make a key once and keep its secret half off the build machines; sign each
model file when it is released:

```sh
python3 tool/sign_model.py keygen rayo-models.pem      # prints the public key, hex
python3 tool/sign_model.py sign rayo-models.pem model.weights   # writes model.weights.sig
# or, with OpenSSL 3: openssl pkeyutl -sign -rawin -inkey rayo-models.pem \
#                       -in model.weights -out model.weights.sig
```

Ship the public key (32 bytes) in the app; serve `model.weights` and its 64-byte `.sig`.

**Checking, in C.** Set `rayo_model_options.integrity`: rayo checks the bytes it is about to
read (the mapping, or its copy) and returns `RAYO_ERR_INTEGRITY` without parsing anything
when they do not match.

```c
rayo_integrity want;
rayo_model_options o;
memset(&want, 0, sizeof want);
want.public_key = publisher_key; /* 32 bytes */
want.signature = signature;      /* the 64 bytes of model.weights.sig */
memset(&o, 0, sizeof o);
o.integrity = &want;
status = rayo_model_load("model.weights", &o, &model, &msg);
```

`rayo_verify` and `rayo_verify_file` check bytes or a file alone; `want.sha256` adds (or is
instead) a SHA-256.

**Checking, in Dart.**

```dart
final model = RayoModel.map(path, integrity: RayoIntegrity(
    publicKey: publisherKey, signature: File('$path.sig').readAsBytesSync()));
// A mismatch throws RayoException with status rayoErrIntegrity.
```

`RayoModel.load(bytes, integrity: ...)`, `rayoVerify` and `rayoVerifyFile` do the same for
bytes and files. rayo does not decide when a signature is required: the app does (bundled
models may be checked by SHA-256 alone; a model that arrived over the network should be
refused unless its signature is the publisher's).

## How it is checked

- **Fuzzing** (`tests/fuzz`, `tool/ci/fuzz.sh`): libFuzzer with ASan and UBSan on the model
  loader with the graph, a session planned and run (`model`), the graph alone with its data
  made to fit (`graph`), the tokeniser's table (`tokenizer_table`), tokenizer.json
  (`tokenizer_json`), and arbitrary text through five tokenisers (`tokenize`). CI's `fuzz`
  job runs each for a minute; `sanitizers` replays the corpora and `tests/malformed` through
  every target. An AFL++ build: `tool/ci/fuzz.sh afl OUT`.
- **Malformed files** (`tests/malformed`, written by `tool/make_malformed.py`): each file is
  wrong in one way and `tests/test_security.c` expects its status.
- **Sanitizers**: the whole C suite under ASan, LSan and UBSan with every kernel set.
- **Static analysis** (`tool/ci/analyze.sh`, CI's `analyze` job): the clang static analyzer
  (as scan-build runs it) and cppcheck's warning, portability and performance checks find
  nothing. Two cppcheck findings are suppressed where they are, as not bugs: the pointer size
  in `rayo_aligned_alloc` is meant, and its block is freed from the pointer stored before the
  aligned data.

## Reporting a vulnerability

Report it privately through GitHub's security advisories for this repository ("Report a
vulnerability"), with a file or text that shows it if you can.
