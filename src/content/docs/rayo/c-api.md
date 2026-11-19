---
title: "C API reference"
description: "Every public function and type of rayo's C API, with its declaration as the headers give it. Include the umbrella header, which includes all of them:"
section: "rayo"
order: 14
repo: "rayo"
path: "docs/API-C.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/API-C.md"
---
Every public function and type of rayo's C API, with its declaration as the headers give it.
Include the umbrella header, which includes all of them:

```c
#include "rayo/rayo.h"
```

The rules that hold for every function, so they are not repeated below:

- A function that can fail returns a [`rayo_status`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_status) and takes an optional
  [`rayo_message *msg`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_message) last; on failure the message says why. Pass `NULL` to
  skip it.
- `*_create` and `*_load` give the caller a new object, freed with the matching `*_destroy`.
  Every destroy function accepts `NULL`.
- Strings, views and tables an object returns belong to that object and live as long as it
  does, unless the function says otherwise.
- Options structs (`rayo_model_options`, `rayo_session_options`, `rayo_integrity`,
  `rayo_sampler_options`, `rayo_generator_options`) must be **zeroed with `memset`** before you
  set fields, so fields added in later versions keep their defaults.
- One session, tokeniser encode, sampler or generator is used by one thread at a time; a
  model is read-only once loaded and may be shared.

[Concepts](/docs/rayo/concepts/) explains models, sessions, size symbols and states.

## Contents

| Header | |
| --- | --- |
| [`rayo/error.h`](#errors-rayoerrorh) | statuses and messages |
| [`rayo/types.h`, `rayo/tensor.h`](#types-rayotypesh-rayotensorh) | fixed-size types, dtypes, shapes, tensor views |
| [`rayo/model.h`](#models-rayomodelh) | loading a model, describing it, memory |
| [`rayo/session.h`](#sessions-rayosessionh) | running a model, threads, the CPU's cores |
| [`rayo/text.h`](#text-rayotexth) | the tokeniser and the sampler |
| [`rayo/generate.h`](#generation-rayogenerateh) | text from a language model |
| [`rayo/verify.h`, `rayo/sha256.h`](#integrity-rayoverifyh-rayosha256h) | SHA-256 and Ed25519 checks |
| [`rayo/op.h`](#ops-of-your-own-rayooph) | ops of your own |
| [`rayo/version.h`, `rayo/config.h`](#version-and-options-rayoversionh-rayoconfigh) | the version, compile-time options |

## Errors: `rayo/error.h`

### `rayo_status`

```c
typedef enum rayo_status {
  RAYO_OK = 0,
  RAYO_ERR_INVALID_ARGUMENT = 1, /* a null pointer, an index out of range */
  RAYO_ERR_FORMAT = 2,           /* the model file is damaged or not one */
  RAYO_ERR_UNSUPPORTED = 3,      /* a version, op or dtype this rayo does not run */
  RAYO_ERR_OUT_OF_MEMORY = 4,
  RAYO_ERR_SHAPE = 5,    /* sizes that do not fit the graph */
  RAYO_ERR_LIMIT = 6,    /* more than a limit of rayo/config.h allows */
  RAYO_ERR_INTEGRITY = 7 /* bytes that do not match their SHA-256 or signature */
} rayo_status;
```

What every fallible function returns. [Troubleshooting](/docs/rayo/troubleshooting/) lists the common
messages of each.

### `rayo_message`

```c
typedef struct rayo_message {
  char text[256];
} rayo_message;
```

A human-readable reason for a failed call, NUL-terminated, at most 255 bytes. Only filled in
when a call fails.

### `rayo_status_str`

```c
RAYO_API const char *rayo_status_str(rayo_status status);
```

A static name for `status`: `"ok"`, `"invalid argument"`, `"format error"`,
`"unsupported"`, `"out of memory"`, `"shape error"`, `"over a limit"`,
`"integrity check failed"`.

## Types: `rayo/types.h`, `rayo/tensor.h`

### `rayo_dtype`

```c
typedef enum rayo_dtype {
  RAYO_DTYPE_F32 = 0,
  RAYO_DTYPE_I32 = 1,
  RAYO_DTYPE_I8 = 2,
  RAYO_DTYPE_I4 = 3,
  RAYO_DTYPE_I3 = 4
} rayo_dtype;
```

An element type. Inputs and outputs are `RAYO_DTYPE_F32` or `RAYO_DTYPE_I32`;
`RAYO_DTYPE_I4` and `RAYO_DTYPE_I3` are for weights only (groups with a scale each,
[FORMAT.md](/docs/rayo/format/#int4-tensors)).

The fixed-size integer types are C89 typedefs with compile-time size checks: `rayo_i8`,
`rayo_u8`, `rayo_i16`, `rayo_u16`, `rayo_i32`, `rayo_u32`, `rayo_f32` (`float`),
`rayo_size` (`size_t`) and `rayo_bool` (`int`, with `RAYO_TRUE` and `RAYO_FALSE`). Every
dimension is a `rayo_i32` (`RAYO_I32_MAX`, 2^31 - 1, at most), every byte count a `size_t`.

### `rayo_shape`

```c
typedef struct rayo_shape {
  rayo_i32 rank;
  rayo_i32 dims[RAYO_MAX_RANK];
} rayo_shape;
```

Row-major (C order) dimensions, outermost first.

### `rayo_tensor_view`

```c
typedef struct rayo_tensor_view {
  const char *name; /* owned by the model */
  rayo_dtype dtype;
  rayo_shape shape;
  void *data;
  size_t bytes; /* of `data` at the current shape */
} rayo_tensor_view;
```

A tensor the caller reads or writes in place. The memory belongs to the session or model it
came from and stays valid until that object is destroyed (a session's output: until its next
run). `shape` is the current one, after [`rayo_session_bind`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_session_bind). Cast
`data` to `rayo_f32 *` or `rayo_i32 *` by `dtype`.

## Models: `rayo/model.h`

### `rayo_model_load`

```c
RAYO_API rayo_status rayo_model_load(const char *path, const rayo_model_options *options,
                                     rayo_model **out, rayo_message *msg);
```

Loads the model file at `path` (`options` may be `NULL`). The file is mapped (mmap,
`MapViewOfFile`) and its weights are used where they are, with no copy: the system reads
their pages as they are touched and may drop them again under memory pressure, so a model
costs what a run touches. Where the system cannot map files (or with
`options->read_file`), the file is read into memory instead. **The file must not change while
the model lives.** The usual way to open a model.

```c
rayo_model *model = NULL;
rayo_message msg;
if (rayo_model_load("model.weights", NULL, &model, &msg) != RAYO_OK) {
  fprintf(stderr, "%s\n", msg.text);
}
```

### `rayo_model_create`

```c
RAYO_API rayo_status rayo_model_create(const void *data, size_t size, rayo_model **out,
                                       rayo_message *msg);
```

Reads a model from the `size` bytes at `data`. rayo copies the bytes it needs: the caller may
free `data` as soon as this returns. On success `*out` is a new model the caller frees with
[`rayo_model_destroy`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_model_destroy). The bytes are untrusted: every size and offset is
checked.

### `rayo_model_create_with`

```c
RAYO_API rayo_status rayo_model_create_with(const void *data, size_t size,
                                            const rayo_model_options *options, rayo_model **out,
                                            rayo_message *msg);
```

[`rayo_model_create`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_model_create) with `options` (`NULL`: the defaults): ops of your
own, or an integrity check.

### `rayo_model_options`

```c
typedef struct rayo_model_options {
  const struct rayo_custom_op *const *ops;
  int op_count;
  int read_file;
  int access;
  const struct rayo_integrity *integrity;
} rayo_model_options;
```

| Field | |
| --- | --- |
| `ops`, `op_count` | ops of the program's own ([`rayo_custom_op`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_custom_op)) the graph may name, besides the built-in ones; their names must differ from those. The ops must stay valid while the model lives. |
| `read_file` | `rayo_model_load` only: `1` reads the file into memory of rayo's instead of mapping it. |
| `access` | `rayo_model_load` only: a [`rayo_access`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_access) hint for the mapped file. |
| `integrity` | what the file must match ([`rayo_integrity`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_integrity)), checked before rayo reads any of it: a mismatch is `RAYO_ERR_INTEGRITY`. `NULL`: no check. |

```c
rayo_model_options o;
memset(&o, 0, sizeof o);
o.integrity = &want; /* a rayo_integrity with the SHA-256 or signature */
status = rayo_model_load(path, &o, &model, &msg);
```

### `rayo_access`

```c
typedef enum rayo_access {
  RAYO_ACCESS_DEFAULT = 0,
  RAYO_ACCESS_NORMAL,     /* the system's own read-ahead */
  RAYO_ACCESS_SEQUENTIAL, /* front to back (MADV_SEQUENTIAL) */
  RAYO_ACCESS_WILLNEED,   /* all of it, soon: read ahead now (MADV_WILLNEED) */
  RAYO_ACCESS_RANDOM      /* no read-ahead (MADV_RANDOM) */
} rayo_access;
```

How a mapped model's file will be read, a hint to the system's read-ahead (`madvise`).
`RAYO_ACCESS_DEFAULT` is rayo's choice, `WILLNEED`, measured on a decoder under memory
pressure ([RUNNING-SLMS.md](/docs/rayo/small-language-models/#what-to-expect)). No hint where the file is read
into memory or the system takes none.

### `rayo_model_destroy`

```c
RAYO_API void rayo_model_destroy(rayo_model *model);
```

Frees `model` (`NULL` is fine). Destroy its sessions, tokenisers read from it and generators
first.

### `rayo_model_name`

```c
RAYO_API const char *rayo_model_name(const rayo_model *model);
```

The header's `"model"` name, such as `"example-classifier"`. Owned by the model.

### `rayo_model_metadata_json`

```c
RAYO_API const char *rayo_model_metadata_json(const rayo_model *model);
```

The header's `"metadata"` object as JSON text (`"{}"` when absent). Owned by the model.
rayo-convert writes a language model's stop tokens, chat template and BOS setting here, and
anything given with `--metadata`.

### `rayo_model_input_count`

```c
RAYO_API int rayo_model_input_count(const rayo_model *model);
```

The number of the graph's inputs.

### `rayo_model_output_count`

```c
RAYO_API int rayo_model_output_count(const rayo_model *model);
```

The number of the graph's outputs.

### `rayo_model_input_info`

```c
RAYO_API rayo_status rayo_model_input_info(const rayo_model *model, int index,
                                           rayo_tensor_view *out);
```

The name, dtype and **largest** shape of input `index`; `data` is `NULL`.
`RAYO_ERR_INVALID_ARGUMENT` when `index` is out of range.

### `rayo_model_output_info`

```c
RAYO_API rayo_status rayo_model_output_info(const rayo_model *model, int index,
                                            rayo_tensor_view *out);
```

The same for output `index`.

### `rayo_model_memory`

```c
RAYO_API void rayo_model_memory(const rayo_model *model, rayo_memory_info *out);
```

What the model holds, in bytes ([`rayo_memory_info`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_memory_info)): its file (copied or
mapped) and packed weights in `weights`, the graph and tables in `overhead`.

### `rayo_memory_info`

```c
typedef struct rayo_memory_info {
  size_t weights;  /* the model's file (copied, or mapped), and packed weights */
  size_t arena;    /* a session's activations and scratch, planned once */
  size_t overhead; /* bookkeeping: graph, plans, tables */
  size_t states;   /* of `arena`: a session's states (a decoder's key/value cache), in full */
} rayo_memory_info;
```

### `rayo_process_memory`

```c
RAYO_API rayo_status rayo_process_memory(rayo_process_memory_info *out);
```

Fills `out` for this process. `RAYO_ERR_UNSUPPORTED` (and zeros) where the system does not
say (Windows and plain C89 builds, for now).

### `rayo_process_memory_info`

```c
typedef struct rayo_process_memory_info {
  size_t private_bytes;
  size_t file_bytes;
  size_t resident_bytes;      /* both */
  size_t peak_resident_bytes; /* the most resident so far (0 if unknown) */
} rayo_process_memory_info;
```

| Field | |
| --- | --- |
| `private_bytes` | resident memory of the process's own (the heap, a session's arena and cache, stacks), which the system must keep while it lives. Linux and Android: `smaps_rollup`'s Anonymous (or `statm`'s resident less shared, on kernels before 4.14); macOS: `task_info`'s internal. |
| `file_bytes` | resident pages of mapped files (the weights, the program itself), which the system can drop under pressure and read again. |
| `resident_bytes` | both. |
| `peak_resident_bytes` | the most resident so far (0 if unknown). |

## Sessions: `rayo/session.h`

### `rayo_session_create`

```c
RAYO_API rayo_status rayo_session_create(const rayo_model *model, rayo_session **out,
                                         rayo_message *msg);
```

A session plans all of its memory when it is created, for the largest sizes the graph
allows: [`rayo_session_run`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_session_run) allocates nothing. On success `*out` is a new
session the caller owns and frees with [`rayo_session_destroy`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_session_destroy), before
the model. One session runs on one thread at a time; separate sessions may run at once.

### `rayo_session_create_with`

```c
RAYO_API rayo_status rayo_session_create_with(const rayo_model *model,
                                              const rayo_session_options *options,
                                              rayo_session **out, rayo_message *msg);
```

[`rayo_session_create`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_session_create) with `options` (`NULL`: the defaults): threads,
an int8 key/value cache, and lower limits for size symbols and states.

```c
rayo_session_options o;
rayo_symbol_limit limits[2];
memset(&o, 0, sizeof o);
o.threads = -1;              /* the fast cores */
o.cache = RAYO_CACHE_INT8;   /* a quarter of the cache's memory */
o.state_rows = 1024;         /* at most 1024 tokens in the cache */
limits[0].name = "T";        /* prompt chunks of at most 32 tokens */
limits[0].max = limits[0].plan = 32;
limits[1].name = "P";        /* P + T within the 1024 rows */
limits[1].max = 1023;
limits[1].plan = 1024 - 32;
o.limits = limits;
o.limit_count = 2;
status = rayo_session_create_with(model, &o, &session, &msg);
```

### `rayo_session_options`

```c
typedef struct rayo_session_options {
  int threads;
  int cache;
  rayo_i32 state_rows;
  const rayo_symbol_limit *limits;
  int limit_count;
} rayo_session_options;
```

| Field | |
| --- | --- |
| `threads` | the threads a run uses, the caller's included: `0` or `1` for one (the default), `-1` for [`rayo_cpu_fast_cores()`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_cpu_fast_cores). The results are the same, bit for bit, with any number: work is split by output, never within a sum. |
| `cache` | `RAYO_CACHE_FLOAT32` (0) or `RAYO_CACHE_INT8` ([`rayo_cache_type`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_cache_type)). |
| `state_rows` | at most this many rows (the first dimension) in each state, such as a cache's tokens: 0 for the graph's sizes. With it, give `limits` that keep the symbols within the rows (a decoder's `P + T` at most `state_rows`). |
| `limits`, `limit_count` | lower limits of size symbols ([`rayo_symbol_limit`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_symbol_limit)); `NULL`: none. |

### `rayo_symbol_limit`

```c
typedef struct rayo_symbol_limit {
  const char *name;
  rayo_i32 max;
  rayo_i32 plan;
} rayo_symbol_limit;
```

A lower limit for size symbol `name`: at most `max` (at most the graph's largest), and memory
planned for `plan` (at most `max`), in place of the graph's own plan.

### `rayo_cache_type`

```c
typedef enum rayo_cache_type {
  RAYO_CACHE_FLOAT32 = 0, /* as the graph declares them */
  RAYO_CACHE_INT8 = 1
} rayo_cache_type;
```

How a session keeps the states that are key/value caches. `RAYO_CACHE_INT8`: int8 with a
float32 scale per row (token) and head, a quarter of the memory. It applies to each state
that only `cache_write` nodes write and only `attention` nodes read; attention's outputs
differ from float32's by the rounding of the keys and values ([OPS.md](/docs/rayo/ops/#cache_write)).

### `rayo_session_destroy`

```c
RAYO_API void rayo_session_destroy(rayo_session *session);
```

Frees `session` (`NULL` is fine).

### `rayo_session_bind`

```c
RAYO_API rayo_status rayo_session_bind(rayo_session *session, const char *name, rayo_i32 value,
                                       rayo_message *msg);
```

Sets size symbol `name` (such as `"T"`) to `value`, at most the largest the graph declares,
for the next runs. `RAYO_ERR_INVALID_ARGUMENT` for a symbol the graph does not have;
`RAYO_ERR_SHAPE` for a value out of range.

### `rayo_session_input`

```c
RAYO_API rayo_status rayo_session_input(rayo_session *session, int index, rayo_tensor_view *out);
```

Input `index`, at the current sizes, for the caller to write into. The memory belongs to the
session.

### `rayo_session_run`

```c
RAYO_API rayo_status rayo_session_run(rayo_session *session, rayo_message *msg);
```

Runs the graph on the inputs written. Allocates nothing. Token ids out of a table's range and
other bad input values are checked, never trusted.

### `rayo_session_output`

```c
RAYO_API rayo_status rayo_session_output(const rayo_session *session, int index,
                                         rayo_tensor_view *out);
```

Output `index` of the last run, for the caller to read. The memory belongs to the session and
changes at the next run.

### `rayo_session_reset`

```c
RAYO_API void rayo_session_reset(rayo_session *session);
```

Zeroes the session's states (such as a decoder's key/value cache), to start a new sequence;
their whole pages go back to the system until they are written again. `NULL` is fine.

### `rayo_session_kernels`

```c
RAYO_API const char *rayo_session_kernels(const rayo_session *session);
```

The kernels the session runs: `"generic"`, `"sse4.1"`, `"avx2"`, `"avx-vnni"`, `"neon"`,
`"neon-dotprod"` or `"neon-i8mm"`, chosen from what the CPU has. Static.

### `rayo_session_threads`

```c
RAYO_API int rayo_session_threads(const rayo_session *session);
```

The threads the session runs on.

### `rayo_session_memory`

```c
RAYO_API void rayo_session_memory(const rayo_session *session, rayo_memory_info *out);
```

What the session holds ([`rayo_memory_info`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_memory_info)): `arena` (its activations,
states and scratch) and `states` (of `arena`, the states in full).

### `rayo_cpu_fast_cores`

```c
RAYO_API int rayo_cpu_fast_cores(void);
```

The CPU cores worth running on: a phone's big cores (from `/sys` on Android and Linux), a
Mac's performance or physical cores, else the cores online; at least 1.

### `rayo_cpu_default_threads`

```c
RAYO_API int rayo_cpu_default_threads(void);
```

The threads a language model runs on by default: at most 2 of the fast cores on Android, at
most 4 elsewhere; at least 1.

## Text: `rayo/text.h`

The tokeniser reads the kinds of `tokenizer.json` decoder-only models ship: a BPE model
(byte-level, as GPT-2-style tokenisers; or SentencePiece-style with byte fallback) or a
Unigram model; Split, ByteLevel, Digits and Metaspace pre-tokenisers; Replace and Prepend
normalisers (NFC is taken to hold already); and added tokens, matched in the text as
themselves. A file with anything else is refused when it is read, naming what.

### `rayo_tokenizer_from_model`

```c
RAYO_API rayo_status rayo_tokenizer_from_model(const rayo_model *model, rayo_tokenizer **out,
                                               rayo_message *msg);
```

The tokeniser whose table rayo-convert wrote into `model`'s file ([FORMAT.md](/docs/rayo/format/#the-tokenisers-table)),
read where it is in the mapped file: nothing is parsed or copied but its few patterns.
`model` must outlive it. `RAYO_ERR_UNSUPPORTED` when the file has no table. The way to get a
language model's tokeniser.

### `rayo_tokenizer_create`

```c
RAYO_API rayo_status rayo_tokenizer_create(const char *json, size_t size, rayo_tokenizer **out,
                                           rayo_message *msg);
```

Reads the `size` bytes of `tokenizer.json` at `json`. rayo keeps what it needs: the caller may
free `json` when this returns. Reading allocates memory for the file's parse, then frees it.

### `rayo_tokenizer_load`

```c
RAYO_API rayo_status rayo_tokenizer_load(const char *path, rayo_tokenizer **out, rayo_message *msg);
```

The same, from the file at `path`.

### `rayo_tokenizer_create_table`

```c
RAYO_API rayo_status rayo_tokenizer_create_table(const void *table, size_t size,
                                                 rayo_tokenizer **out, rayo_message *msg);
```

The tokeniser of a table of `size` bytes at `table`, 4-byte aligned, which must outlive it:
read where it is.

### `rayo_tokenizer_table`

```c
RAYO_API rayo_status rayo_tokenizer_table(const rayo_tokenizer *tokenizer, const void **table,
                                          size_t *size);
```

The tokeniser's table: `*size` bytes at `*table`, owned by the tokeniser (or its model). A
tokeniser read from a `tokenizer.json` has one too, the same bytes rayo-convert writes for
that file.

### `rayo_tokenizer_destroy`

```c
RAYO_API void rayo_tokenizer_destroy(rayo_tokenizer *tokenizer);
```

Frees `tokenizer` (`NULL` is fine). Destroy the generators that use it first.

### `rayo_tokenizer_vocab_size`

```c
RAYO_API rayo_i32 rayo_tokenizer_vocab_size(const rayo_tokenizer *tokenizer);
```

One more than the largest token id.

### `rayo_tokenizer_encode`

```c
RAYO_API rayo_status rayo_tokenizer_encode(const rayo_tokenizer *tokenizer, const char *text,
                                           size_t size, rayo_i32 *ids, size_t capacity,
                                           size_t *count, rayo_message *msg);
```

The token ids of the `size` bytes of UTF-8 text at `text`, into `ids` (room for `capacity`).
`*count` is how many there are, also when they do not fit (then `RAYO_ERR_SHAPE`, and the
first `capacity` are written). Encoding allocates working memory and frees it before it
returns. Text over `RAYO_MAX_TEXT_BYTES` is `RAYO_ERR_LIMIT`.

```c
rayo_i32 ids[256];
size_t n = 0;
status = rayo_tokenizer_encode(tok, "Hello", 5, ids, 256, &n, &msg);
```

### `rayo_tokenizer_piece`

```c
RAYO_API const char *rayo_tokenizer_piece(const rayo_tokenizer *tokenizer, rayo_i32 id,
                                          size_t *size);
```

The bytes token `id` stands for in text (`*size` of them, **not NUL-terminated**), owned by
the tokeniser; `NULL` for an id it does not have. A multi-byte character may be split across
tokens: join the pieces before showing them.

### `rayo_tokenizer_find`

```c
RAYO_API rayo_i32 rayo_tokenizer_find(const rayo_tokenizer *tokenizer, const char *token);
```

The id of the token whose text is `token` (an added token such as `"<|im_end|>"`, or a
vocabulary entry), or -1.

### `rayo_sampler_options`

```c
typedef struct rayo_sampler_options {
  float temperature;        /* <= 0: greedy */
  rayo_i32 top_k;           /* keep the k most likely (0: all) */
  float top_p;              /* then the fewest whose probabilities add up to p (0 or 1: all) */
  float min_p;              /* then those at least min_p times the most likely (0: all) */
  float repetition_penalty; /* > 1: recent tokens' logits divided (positive) or multiplied */
  rayo_u32 seed;            /* the same seed and inputs give the same tokens */
} rayo_sampler_options;
```

Choosing the next token. Zero the options and set what you need: zeros mean greedy decoding
(the most likely token).

### `rayo_sampler_create`

```c
RAYO_API rayo_status rayo_sampler_create(rayo_i32 vocab, const rayo_sampler_options *options,
                                         rayo_sampler **out, rayo_message *msg);
```

A sampler for logits of `vocab` values. It holds all its working memory:
[`rayo_sampler_next`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_sampler_next) allocates nothing.

### `rayo_sampler_destroy`

```c
RAYO_API void rayo_sampler_destroy(rayo_sampler *sampler);
```

Frees `sampler` (`NULL` is fine).

### `rayo_sampler_next`

```c
RAYO_API rayo_i32 rayo_sampler_next(rayo_sampler *sampler, const float *logits,
                                    const rayo_i32 *recent, size_t recent_count);
```

The next token from `logits` (`vocab` floats, not changed), with the repetition penalty on the
`recent_count` ids at `recent`.

## Generation: `rayo/generate.h`

A generator joins a session of a decoder converted by rayo-convert (its input the tokens, its
output the last position's logits, symbols `P` and `T`), its tokeniser and a sampler; it keeps
the key/value cache across calls, so a chat goes on where it left off. Each call does a
bounded amount of work (a prompt chunk, or one token), so a caller cancels by not calling
again. Running the model allocates nothing; only the tokeniser's encoding of new text takes
working memory, and frees it.

```c
rayo_generator_options o;
rayo_generator *g = NULL;
rayo_i32 token;
size_t size;
memset(&o, 0, sizeof o);             /* greedy, one thread, 1024 tokens, chunks of 32 */
o.threads = rayo_cpu_default_threads();
o.cache = RAYO_CACHE_INT8;
o.max_tokens = 200;
if (rayo_generator_create(model, tok, &o, &g, &msg) != RAYO_OK ||
    rayo_generator_chat(g, NULL, "Hello!", &msg) != RAYO_OK) {
  /* msg.text says why */
}
while (rayo_generator_next(g, &token, &msg) == RAYO_OK && token >= 0) {
  const char *piece = rayo_tokenizer_piece(tok, token, &size);
  fwrite(piece, 1, size, stdout);
}
rayo_generator_destroy(g);
```

[`examples/chat/chat.c`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/chat/chat.c) is a whole chat program on this API.

### `rayo_generator_options`

```c
typedef struct rayo_generator_options {
  rayo_sampler_options sampling; /* zeros: greedy */
  int threads;                   /* as rayo_session_options: 0 or 1 one, -1 the fast cores */
  rayo_i32 max_tokens;           /* per reply: 0 for no limit but the context */
  rayo_i32 context;
  rayo_i32 chunk;
  int cache;
} rayo_generator_options;
```

| Field | |
| --- | --- |
| `sampling` | [`rayo_sampler_options`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_sampler_options); zeros: greedy. |
| `threads` | as `rayo_session_options`: 0 or 1 for one, -1 for the fast cores. |
| `max_tokens` | per reply: 0 for no limit but the context. |
| `context` | the most tokens the conversation holds, at most the model's (its converter's `--context`): 0 for `RAYO_GENERATOR_CONTEXT` (1024) or the model's, whichever is less. The key/value cache is sized for this, not for the model's longest. |
| `chunk` | the most prompt tokens one run takes, at most the model's: 0 for `RAYO_GENERATOR_CHUNK` (32) or the model's, whichever is less. The working memory is sized for a chunk, whatever the prompt's length; the outputs do not depend on it. |
| `cache` | `RAYO_CACHE_FLOAT32` (0) or `RAYO_CACHE_INT8`, a quarter of the memory. |

### `rayo_generator_create`

```c
RAYO_API rayo_status rayo_generator_create(const rayo_model *model, const rayo_tokenizer *tokenizer,
                                           const rayo_generator_options *options,
                                           rayo_generator **out, rayo_message *msg);
```

A generator for `model` (a decoder converted by rayo-convert) and `tokenizer` (its
tokeniser), both of which must outlive it. The stop tokens, the chat template's pieces and
whether a prompt starts with BOS come from the model's metadata.

### `rayo_generator_destroy`

```c
RAYO_API void rayo_generator_destroy(rayo_generator *generator);
```

Frees `generator` (`NULL` is fine), its session and sampler.

### `rayo_generator_chat`

```c
RAYO_API rayo_status rayo_generator_chat(rayo_generator *generator, const char *system,
                                         const char *user, rayo_message *msg);
```

Adds a user's turn (and, before the first, an optional `system` text) in the model's own chat
template, and runs it through the model. Then call [`rayo_generator_next`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_generator_next)
for the reply. `RAYO_ERR_UNSUPPORTED` when the model has no chat template (or its template
takes no system text); `RAYO_ERR_SHAPE` when the context is full.

### `rayo_generator_prompt`

```c
RAYO_API rayo_status rayo_generator_prompt(rayo_generator *generator, const char *text, size_t size,
                                           rayo_message *msg);
```

Adds `size` bytes of raw text (BOS first, at the start, if the model wants one) and runs it
through the model, for the reply to continue it.

### `rayo_generator_next`

```c
RAYO_API rayo_status rayo_generator_next(rayo_generator *generator, rayo_i32 *token,
                                         rayo_message *msg);
```

The next token of the reply in `*token`, or -1 when the reply has ended (a stop token,
`max_tokens`, or a full context). `RAYO_ERR_INVALID_ARGUMENT` ("no prompt yet") before any
`chat` or `prompt`.

### `rayo_generator_reset`

```c
RAYO_API void rayo_generator_reset(rayo_generator *generator);
```

Forgets the conversation: an empty cache, position 0.

### `rayo_generator_position`

```c
RAYO_API rayo_i32 rayo_generator_position(const rayo_generator *generator);
```

Tokens in the cache.

### `rayo_generator_context`

```c
RAYO_API rayo_i32 rayo_generator_context(const rayo_generator *generator);
```

The most tokens the cache holds.

### `rayo_generator_can_chat`

```c
RAYO_API rayo_bool rayo_generator_can_chat(const rayo_generator *generator);
```

Whether the model's metadata has a chat template (rayo-convert with jinja2 installed writes
it).

### `rayo_generator_threads`

```c
RAYO_API int rayo_generator_threads(const rayo_generator *generator);
```

The session's threads, for reports.

### `rayo_generator_kernels`

```c
RAYO_API const char *rayo_generator_kernels(const rayo_generator *generator);
```

The session's kernels, for reports, as [`rayo_session_kernels`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_session_kernels).

## Integrity: `rayo/verify.h`, `rayo/sha256.h`

rayo has its own SHA-256, SHA-512 and Ed25519 (RFC 8032), so an app can require that a model
it downloaded is the one its publisher signed, with no other library
([SECURITY.md](/docs/rayo/security/#requiring-signed-models)).

### `rayo_integrity`

```c
typedef struct rayo_integrity {
  const rayo_u8 *sha256;
  const rayo_u8 *public_key;
  const rayo_u8 *signature;
} rayo_integrity;
```

What a model file must match. Zero it and set what you need: each part that is set is
checked, and every check must pass.

| Field | |
| --- | --- |
| `sha256` | the 32 bytes of the file's SHA-256, or `NULL`. |
| `public_key`, `signature` | an Ed25519 public key (32 bytes) and the file's signature by it (64 bytes: "pure" Ed25519 over the whole file, as `openssl pkeyutl -sign -rawin` or `tool/sign_model.py` writes it), or both `NULL`. |

### `rayo_verify`

```c
RAYO_API rayo_status rayo_verify(const void *data, size_t size, const rayo_integrity *want,
                                 rayo_message *msg);
```

`RAYO_OK` when the `size` bytes at `data` match `want`; `RAYO_ERR_INTEGRITY`, with a message
saying which check failed, when they do not; `RAYO_ERR_INVALID_ARGUMENT` when `want` asks for
nothing or gives a public key without a signature (or the reverse).

### `rayo_verify_file`

```c
RAYO_API rayo_status rayo_verify_file(const char *path, const rayo_integrity *want,
                                      rayo_message *msg);
```

The same for the file at `path`, read (mapped where the system can) and released again.

> [!IMPORTANT]
> To *use* the bytes that were checked, pass `want` to `rayo_model_load` or
> `rayo_model_create_with` instead (`rayo_model_options.integrity`): the file could change
> between a separate check and a later load.

### `rayo_sha256`

```c
RAYO_API void rayo_sha256(const void *data, size_t size, rayo_u8 out[32]);
```

Writes the 32-byte digest of the `size` bytes at `data` into `out`.

## Ops of your own: `rayo/op.h`

A model may name ops a program gives rayo when it loads the model, with
[`rayo_model_create_with`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_model_create_with) or [`rayo_model_load`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/API-C.md#rayo_model_load)
(`rayo_model_options.ops`). An op is three functions, as rayo's own are:

- **prepare**, once when the model loads: read the node's attributes and its weights, check
  them, and set the op's parameters (memory from `rayo_op_node_alloc` lives as long as the
  model);
- **infer**, when a session is planned and at every bind: the output's dtype and shape for the
  inputs' current shapes, and the scratch bytes a run needs;
- **run**, for every run: compute the output from the inputs. It must not allocate, and may
  run on several sessions, on several threads, at once: keep anything that changes in
  `scratch`, never in the parameters.

[OPS.md](/docs/rayo/ops/#ops-of-your-own) has a whole example.

### `rayo_custom_op`

```c
typedef struct rayo_custom_op {
  int api_version; /* RAYO_OP_API_VERSION */
  const char *name;
  int min_inputs;
  int max_inputs; /* at most RAYO_OP_MAX_INPUTS (rayo/config.h) */
  void *user;     /* given back to prepare */
  rayo_status (*prepare)(void *user, const rayo_op_node *node, const void **params,
                         rayo_message *msg);
  /* `output`: set its dtype and shape. `*scratch` starts at 0. */
  rayo_status (*infer)(const void *params, const rayo_tensor_view *inputs, int input_count,
                       rayo_tensor_view *output, size_t *scratch, rayo_message *msg);
  /* `scratch`: the bytes infer asked for, RAYO_ALIGN-aligned. */
  rayo_status (*run)(const void *params, const rayo_tensor_view *inputs, int input_count,
                     rayo_tensor_view *output, void *scratch);
} rayo_custom_op;
```

`api_version` is `RAYO_OP_API_VERSION` (1): rayo refuses ops for a version it does not know.
The name must differ from every built-in op's.

### `rayo_op_node_output`

```c
RAYO_API const char *rayo_op_node_output(const rayo_op_node *node);
```

The name of the node's output, for prepare's messages.

### `rayo_op_node_input_count`

```c
RAYO_API int rayo_op_node_input_count(const rayo_op_node *node);
```

The node's inputs.

### `rayo_op_node_input`

```c
RAYO_API rayo_status rayo_op_node_input(const rayo_op_node *node, int index, rayo_tensor_view *out);
```

Input `index`: a weight's name, dtype, shape and data; for an activation or a graph input,
`data` is `NULL` (its shape comes to infer).

### `rayo_op_node_int`

```c
RAYO_API rayo_status rayo_op_node_int(const rayo_op_node *node, const char *key, long fallback,
                                      long *out);
```

Attribute `key` of the node as a whole number; `fallback` when it is absent.
`RAYO_ERR_FORMAT` when it is there but of another kind.

### `rayo_op_node_number`

```c
RAYO_API rayo_status rayo_op_node_number(const rayo_op_node *node, const char *key, double fallback,
                                         double *out);
```

The same, as a number.

### `rayo_op_node_string`

```c
RAYO_API rayo_status rayo_op_node_string(const rayo_op_node *node, const char *key,
                                         const char *fallback, const char **out);
```

The same, as a string owned by the model.

### `rayo_op_node_alloc`

```c
RAYO_API void *rayo_op_node_alloc(const rayo_op_node *node, size_t bytes);
```

`bytes` of zeroed memory, `RAYO_ALIGN`-aligned, freed with the model; `NULL` when out of
memory. For an op's parameters.

### `rayo_op_builtin`

```c
RAYO_API const char *rayo_op_builtin(int index);
```

The ops rayo has built in, by index from 0, for listing them; `NULL` past the last.

```c
int i;
for (i = 0; rayo_op_builtin(i); i++) puts(rayo_op_builtin(i));
```

## Version and options: `rayo/version.h`, `rayo/config.h`

### `rayo_version_string`

```c
RAYO_API const char *rayo_version_string(void);
```

The library's version, `"0.1.0"`. Static storage. The same numbers are macros:
`RAYO_VERSION_MAJOR`, `RAYO_VERSION_MINOR`, `RAYO_VERSION_PATCH`.

### Compile-time options

Define any of these when building rayo **and** every program that includes its headers
(`-DNAME=value`); [`include/rayo/config.h`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/include/rayo/config.h) documents each. Going over
a limit fails with `RAYO_ERR_LIMIT`, naming it.

| Option | Default | |
| --- | --- | --- |
| `RAYO_MAX_RANK` | 4 | the most dimensions a tensor may have; part of the C API (`rayo_shape`), and the Dart bindings assume 4 |
| `RAYO_MAX_DIM` | 2^24 | the largest dimension or size symbol a file may give |
| `RAYO_ALIGN` | 64 | the alignment of the weights and every planned buffer |
| `RAYO_JSON_MAX_DEPTH` | 32 | how deeply a header's JSON may nest |
| `RAYO_OP_MAX_INPUTS` | 16 | the most inputs an op of your own may take |
| `RAYO_MAX_HEADER_BYTES`, `RAYO_MAX_HEADER_VALUES` | 64 MiB, 2^20 | a model file's JSON header |
| `RAYO_MAX_TENSORS`, `RAYO_MAX_NODES`, `RAYO_MAX_SYMBOLS` | 16384, 8192, 64 | a model's tensors, graph nodes and size symbols |
| `RAYO_MAX_ARENA_BYTES` | 2 GiB - 1 | the most a session may plan; lower it to fail early on a phone |
| `RAYO_MAX_TOKENIZER_JSON_BYTES`, `RAYO_MAX_TOKENIZER_JSON_VALUES` | 64 MiB, 2^23 | a `tokenizer.json` |
| `RAYO_MAX_VOCAB` | 2^22 | a tokeniser's vocabulary |
| `RAYO_MAX_TEXT_BYTES` | 16 MiB | the text one encode takes |
| `RAYO_MAX_PATTERN_BYTES`, `RAYO_PATTERN_STEPS` | 4096, 4096 | a tokeniser pattern's size and its matching budget, a code point |

Build macros that are not limits: `RAYO_NO_PLATFORM` (no system headers: files read with
`fread`, one thread), `RAYO_NO_THREADS` (no threads), and `RAYO_AVX2_DECODE` (0 or 1: the
AVX2 decoder product, left out of Android x86_64 builds for size).
