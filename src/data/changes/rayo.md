# Changelog

Written from the conventional commit titles on `main` at each release.

## Unreleased

## 0.1.0 - 2026-11-19

The first release: the C library, `package:rayo` for Dart and Flutter, and rayo-convert.

- **Licence:** AGPL-3.0-only with the rayo Linking Exception (`LICENSE-EXCEPTION`,
  `AGPL-3.0-only WITH AdditionRef-rayo-linking-exception-1.0`): an app that links or embeds
  rayo, unmodified or extended only through its public API, may be distributed under any
  licence; changes to rayo itself stay AGPL-3.0. The exception is a draft for legal review.
  The README's "Embedding rayo" and docs/LICENSING.md explain it.
- **pub.dev:** `package:rayo` is ready to publish: its description, homepage, repository,
  issue tracker, documentation and topics, a `.pubignore` (the Dart library, the C sources,
  headers and licences only) and `example/example.dart`.
- **Examples:** `examples/c/quickstart.c`, the README's C example (built and checked against
  NumPy in CI, `make quickstart`), and `examples/flutter_chat`, a Flutter app that maps a
  language model and runs one prompt in a background isolate (`flutter analyze` and its
  widget tests in CI).
- **CI:** iOS (the C library built for iphoneos and the simulator, an xcframework, and the C
  tests run in a simulator) and Windows (MSVC and clang-cl, the C tests and the quickstart)
  jobs, on pinned runners.
- **Releases:** `.github/workflows/release.yml` checks a tag against the versions, builds the
  release assets (a q4 file of a 135M-parameter instruct model converted by rayo-convert,
  with its SHA-256, licence and attribution) and keeps them as the run's artifact for the
  maintainer to attach; `tool/release/` has the same steps by hand.
- **Benchmarks on a phone:** `tools/slm_bench.c` writes JSON (`--json`), with the model's
  load time, prompt and decode tokens a second (medians of `--runs`) and the peak RSS;
  `tool/bench_phone.sh` builds it with the NDK, runs it over adb and pulls the JSON.
- **Docs:** a developer guide in `docs/` (getting started in C, Dart and Flutter, and
  converting; concepts; the C and Dart API references; performance; licensing; FAQ;
  troubleshooting; roadmap).

- Hardened against untrusted model files and text (docs/SECURITY.md):
  - **Fixed:** a bind that failed left a node's output without its memory, so the next run
    wrote through NULL plus an offset; the tokeniser read freed memory on texts over about 128 bytes with a
    byte-level or Metaspace pre-tokeniser (it copied bytes of a buffer into the same buffer
    while growing it), and gave wrong ids for them; a session's plan could wrap around on
    32-bit systems (armeabi-v7a) for a crafted graph and give a buffer smaller than its
    offsets; a convolution's or attention's scratch size could wrap there too; a Unigram
    score that is not finite (or huge) left positions unreachable and read ids never
    written; a tokenizer.json with one huge id made rayo allocate and zero gigabytes.
  - **Limits** in `include/rayo/config.h` on what one file or text can make rayo allocate or
    compute (header bytes and values, tensors, nodes, symbols, a session's arena,
    tokenizer.json bytes and values, vocabulary, text, patterns and their backtracking), and a
    new status for going over one, `RAYO_ERR_LIMIT`. Graph and tensor names resolve through a
    hash table, BPE merges in O(n log n) (a long word was quadratic), and a tokeniser's
    pattern runs on a budget of steps (one that backtracks catastrophically fails instead of
    hanging); its groups nest at most 16 deep.
  - JSON strings must be UTF-8; numbers are read whatever the C locale; mapped files must be
    regular files, opened with `O_CLOEXEC`; the Dart package decodes names leniently and
    frees a model whose metadata it cannot read.
  - **Signed models:** `rayo_verify`, `rayo_verify_file` and `rayo_model_options.integrity`
    (`include/rayo/verify.h`) check a file's SHA-256 and Ed25519 signature (RFC 8032) before
    rayo reads it, with rayo's own SHA-512 and Ed25519 (c25519, public domain,
    `LICENSES/c25519.txt`), and `RAYO_ERR_INTEGRITY`; in Dart, `RayoIntegrity`,
    `integrity:` on `RayoModel.load`, `loadFile` and `map`, `rayoVerify`, `rayoVerifyFile`;
    `tool/sign_model.py` makes keys and signs. Bindings that declare `rayo_model_options`
    themselves must add the `integrity` pointer (rayo-convert's runtime does).
  - **Hardened builds:** `-fstack-protector-strong -D_FORTIFY_SOURCE=2 -Wformat-security`
    everywhere, RELRO, BIND_NOW and a non-executable stack for the shared libraries, checked
    with readelf (`tool/ci/elf_check.sh`) on the Android libraries and the Dart hook's. Load-time
    code (parsers, checks, verification) is compiled for size, so the Android libraries stay
    within 200 KB.
  - **Checked in CI:** libFuzzer targets for the loader and graph, the tokeniser's table,
    tokenizer.json and text (`tests/fuzz`, `tool/ci/fuzz.sh`, the `fuzz` job); a corpus of
    malformed files with their expected statuses (`tests/malformed`,
    `tool/make_malformed.py`); the clang static analyzer and cppcheck (`tool/ci/analyze.sh`,
    the `analyze` job).

- Faster on phones, the same floats: a thread pool whose workers take parts from a shared
  counter (no wait for late workers, a bounded spin); attention's q · k in eight lanes; NEON
  and SDOT 4-bit and 3-bit products four weight rows at a time; int8 products with the
  ARMv8.6 int8 matrix multiply (SMMLA, `neon-i8mm`, chosen at run time); a decoder's single
  row by eight weight rows with SDOT and AVX-VNNI, and by four with AVX2 (left out of Android
  builds, `RAYO_AVX2_DECODE`, to keep the x86_64 library within 200 KB). Every kernel is
  checked against the generic one, bit for bit, on the blocks' leftover shapes; the
  `bench-compare` CI job times a pull request's base and head on one runner.

- The same floats from every build: rayo is compiled with `-ffp-contract=off` everywhere (the
  Makefile, the CI scripts, the Dart build hook, rayo-convert's `Library.build`), so clang no
  longer fuses multiplies and adds into FMAs on its own. A `clang -O3 -mavx2 -mfma` build now
  gives the same bits as a `gcc -O2` one (`tool/ci/builds.sh`). Builds of `src/` of your own
  should pass the flag too.

- Small language models in less memory, for phones of 2 GB: an int8 key/value cache
  (`RAYO_CACHE_INT8`, a scale per token and head); a session's own context and symbol limits
  (`rayo_session_options.state_rows`, `limits`), the generator's `context` (1024 by
  default), `chunk` (32) and `cache`; float16 group scales for int4 (`scale_dtype`, 4.5 bits a
  weight) and 3-bit groups (`int3`, `rayo-convert --q3` by role), with generic, SSE4.1, AVX2,
  NEON and SDOT kernels the same bit for bit; the tokeniser's table written into the model
  file and read in place (`rayo_tokenizer_from_model`); `madvise` hints on the mapping
  (`rayo_model_options.access`); `rayo_process_memory` (private and file-backed resident);
  `rayo_cpu_default_threads` (2 on Android). A 1000-token chat with a 135M-parameter model: 15 MB of its
  own memory instead of 62 MB. docs/RUNNING-SLMS.md has the numbers.

- rayo is a general runtime, with nothing specific to one model:
  - **Ops:** `compare` and `masked_reduce` replace the Ask reader's `mask`, `masked_max` and
    `masked_mean`. Graphs that name the old ops must be written again: pesaclarity-ml does
    this, and `tests/ask` is updated.
  - **Your own ops:** a program can give rayo ops (`include/rayo/op.h`,
    `rayo_model_create_with`), and `rayo_op_builtin` lists the built-in ones.
  - **No hard caps:** a file's counts (nodes, inputs, outputs, states, symbols, node inputs,
    kernel sizes, dilations) are no longer capped. The remaining limits are compile-time
    options in `include/rayo/config.h`.
  - **Docs and examples:** docs/OPS.md documents every op. `examples/classifier` is a model
    of its own, end to end, and the Ask programs move to `examples/ask`.
- erf is fdlibm's (`LICENSES/fdlibm.txt`) in place of fitted polynomials, checked on every
  float in [0, 4] against the C library's erf (`tool/ci/erf.sh`, in CI and `tool/check`).

- rayo is C89 (ANSI C): every file builds with `-std=c89 -pedantic -Werror` and gcc and clang.
  Dimensions are 32-bit (`rayo_i32`) in the API; the fixed-size types are in
  `include/rayo/types.h`. erf, exp and sqrt come from `src/core/mathx.c`.
- The C tests run the real Ask reader and writer against TFLite (tests/ask) with each kernel
  set; GitHub Actions CI on Linux x86_64 and arm64, armv7, macOS and the Android NDK.

- Decoders: graph states (a key/value cache) with `rayo_session_reset`, a graph `plan` for
  symbols that trade off, and the ops `layer_norm`, `attention`, `cache_write`, `range` and
  `last_row`, and the `gelu_erf` activation. The Ask writer runs on them.

- rayo is its own engine in plain C11: ggml is gone. Models are plain-weights (PCWT) files
  with a graph in the header (docs/FORMAT.md); int8 layers run as TFLite's dynamic-range
  kernels do. Kernels: generic C, SSE4.1/AVX2, AVX-VNNI, NEON and SDOT.
- A session plans its memory once; a run allocates nothing.
- The Dart API is split into bindings, model, session and an isolate runner; inputs and outputs
  are views of native memory.
