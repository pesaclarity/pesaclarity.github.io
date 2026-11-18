# Changelog

Written from the conventional commit titles on `main` at each release.

## Unreleased

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
