---
title: "Model format"
description: "A rayo model is a plain-weights file (PCWT, version 1), the format pesaclarity-ml writes for the app's models (pesaclarity-ml docs/WEIGHTS.md), whose JSON header also holds a graph: the ops that run the tensors."
section: "rayo"
order: 19
repo: "rayo"
path: "docs/FORMAT.md"
commit: "1e536df33c3d0a50b180b7431be52ed9838ebff2"
source: "https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/docs/FORMAT.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/FORMAT.md"
---
A rayo model is a **plain-weights file** (PCWT, version 1), the format pesaclarity-ml writes
for the app's models ([pesaclarity-ml docs/WEIGHTS.md](https://github.com/pesaclarity/pesaclarity-ml/blob/dev/docs/WEIGHTS.md)),
whose JSON header also holds a **`graph`**: the ops that run the tensors. The graph is an
optional header field, which version 1 allows ("unknown header fields are ignored"), so one
file serves rayo and any other reader of version 1 alike. `rayo-convert` writes one from a
TFLite or ONNX model ([CONVERTING.md](/docs/rayo/converting/)).

```
"PCWT" | uint32 version (1) | uint32 header length H | UTF-8 JSON header (H bytes) | tensors
```

All little-endian; the tensor data starts on a 4-byte boundary. rayo checks every size and
offset against the file before it uses them, and refuses what does not fit rather than
guessing; the limits of `include/rayo/config.h` bound the header, the counts and what a
session plans ([SECURITY.md](/docs/rayo/security/#limits)). Strings in the header are UTF-8.

A file is signed as a whole, outside it: a 64-byte Ed25519 signature (RFC 8032) of all its
bytes, conventionally `model.weights.sig`, checked with `rayo_verify` or
`rayo_model_options.integrity` before rayo reads the file ([SECURITY.md](/docs/rayo/security/#requiring-signed-models)).

## Header fields rayo reads

| Field | |
| --- | --- |
| `format_version` | `1`, as bytes 4-7. |
| `model` | the model's name, such as `ask-reader`. |
| `tensors` | as WEIGHTS.md: `name`, `dtype` (`float32`, `int8`, `int4` or `int3`), row-major `shape`, `offset`, `bytes`, and for int8 a `quantization` (`axis` or null, `zero_point`, `scales_offset`, `scales_bytes`); for int4 and int3 see below. |
| `graph` | the graph, below. Required by rayo. |
| `metadata` | optional object, passed to the caller as JSON (labels, sizes, provenance). |
| `tokenizer` | optional: `{"offset", "bytes", "format": "rayo-tokenizer-table", "version": 1}`, the tokeniser's table in the data (below). |

## int4 tensors

Weight-only 4-bit tensors, for language models, in groups along the innermost dimension:

```json
{"name": "l0.q", "dtype": "int4", "shape": [576, 576], "offset": 0, "bytes": 165888,
 "quantization": {"group_size": 32, "zero_point": 8, "scales_offset": 165888,
                  "scales_bytes": 41472}}
```

- **Values:** two a byte, `bytes = count / 2`. Each row is cut into groups of `group_size` (32:
  the only size rayo reads; the innermost dimension must be a multiple of it), stored one after
  the other in 16 bytes each. **Byte j of a group holds value j in its low four bits and value
  j + 16 in its high four**, each stored plus 8 (0 to 15 for -8 to 7).
- **Scales:** one per group, row by row (`count / group_size` of them), at
  `scales_offset`: float32 (`scales_bytes = count / group_size * 4`), or, with
  `"scale_dtype": "float16"` in the `quantization`, IEEE float16 (`count / group_size * 2`).
  Without `scale_dtype` they are float32, as every file before float16 scales.
- **Real value:** `scale[row][group] * (stored - 8)`.

`rayo-convert` maps the value of largest magnitude in each group to -8, so the scale is that
value / -8, rounded to float16 by default (as llama.cpp's Q4_0): 4.5 bits a weight in all
(`--scales float32`: 5 bits, the earlier files). The values are rounded with the stored
scale. rayo reads float16 scales exactly (every float16 is a float32), so a kernel's floats
are the same as with that scale written as float32.

A reader that does not know `int4` refuses the file, naming the dtype; one that does not
know `scale_dtype` finds the scales the wrong size and refuses the file. Neither misreads
it, so the version stays 1.

## int3 tensors

3-bit groups, for the matrices `rayo-convert --q3` names by their role in the graph
(`attn_q`, `attn_k`, `attn_v`, `attn_o`, `mlp_gate`, `mlp_up`, `mlp_down`, `embed`; `mlp` is the
three feed-forward ones):

```json
{"name": "l0.gate", "dtype": "int3", "shape": [1536, 576], "offset": 0, "bytes": 331776,
 "quantization": {"group_size": 32, "zero_point": 4, "scales_offset": 331776,
                  "scales_bytes": 55296, "scale_dtype": "float16"}}
```

- **Values:** groups of 32 along each row, 12 bytes a group (`bytes = count / 32 * 12`), each
  value stored plus 4 (0 to 7 for -4 to 3). **Bytes 0 to 7** hold the low two bits: byte j
  those of values j, j + 8, j + 16 and j + 24, in bits 0-1, 2-3, 4-5 and 6-7. **Bytes 8 to
  11**, a little-endian 32-bit word, hold the third bits: bit i that of value i.
- **Scales** as int4's (float32 or float16); **real value:** `scale[row][group] * (stored - 4)`.
- `rayo-convert` picks each group's scale from `top / -4 * f`, `top` the value of largest
  magnitude and f one of 1, 0.95, ..., 0.7, for the least squared error. 3.5 bits a weight
  with float16 scales.

## The tokeniser's table

`rayo-convert` writes the model's tokenizer.json, read as rayo reads it, into the file as one
block of little-endian 32-bit words and bytes, at the start of the data (`"tokenizer"` in the
header). rayo reads it where it is in the mapped file (`rayo_tokenizer_from_model`): hash
tables of the vocabulary and the merges, each token's text, the added tokens, the
pre-tokeniser and normaliser steps. Nothing is parsed or copied at run time but the steps'
few patterns. rayo builds the same bytes from a tokenizer.json (`rayo_tokenizer_create`, for
tests and tools), and the tests check that the converter's and rayo's are equal.

```
header: 32 words
  0 "RTOK"  1 version (1)  2 flags  3 unk id (-1: none)  4 vocabulary size V  5 longest token
  6 min score (float32)  7 vocabulary slots  8 merge slots (0: none)  9 added tokens
  10 pre-tokeniser steps  11 normaliser steps  12 pool bytes  13-21 the sections' offsets
  (vocabulary, merges, pieces, scores, added, steps, normalisers, byte ids, pool; scores 0
  when not Unigram)  22 the table's bytes  23-31 zero
vocabulary   slots x (string offset, length, id; id -1: empty), FNV-1a of the bytes,
             linear probing, at least 2V + 1 slots (a power of two, at least 16)
merges       slots x (a, b, rank, merged; a -1: empty), the pair hash of tokenizer_json.c
pieces       V x (offset, length): each id's text as output (0xFFFFFFFF: none)
scores       V float32 (Unigram)
added        (offset, length, id), longest first, the file's order among equals
steps        (kind, flags, string offset, length): Split (its pattern), ByteLevel, Digits,
             Metaspace (its replacement)
normalisers  (kind, from offset, length, to offset, length): Replace, Prepend
byte ids     256 ids of the <0xXX> tokens (-1: none)
pool         the strings, in order: the pieces by id, then each vocabulary slot's string
             unless it equals its id's piece, then each added token's (likewise), then the
             steps' strings; padded to a whole word
```

Flags: 1 Unigram, 2 byte-level, 4 byte fallback, 8 ignore merges, 16 SentencePiece's `▁`
shown as a space. Step flags: 1 use the regex, 2 add a prefix, 4 removed (Split), 8
individual digits, 16 split (Metaspace), 32 prefix the first word only. rayo checks every
offset, length and id against the table before it reads it. A reader that does not know the
`tokenizer` field ignores it (unknown header fields are ignored), so the version stays 1.

## Alignment

Tensor offsets need only be multiples of 4. `rayo-convert` writes language models with the
data, and every tensor and scale table, starting at multiples of 64 bytes from the start of
the file (the header is padded with spaces), so a file mapped with `rayo_model_load` gives
the kernels aligned weights. rayo reads unaligned files as well: every SIMD load is an
unaligned one.

**Size limits.** Offsets and sizes are 32-bit (C89 has no 64-bit integers), so a file holds
at most 2 GiB of data: a 0.5B-parameter model in float32 just fits, a 1.5B one only in int8
or int4. A later version may write offsets as two numbers.

## The graph (version 1)

```json
"graph": {
  "version": 1,
  "symbols": {"T": 96},
  "inputs": [{"name": "tokens", "dtype": "int32", "shape": ["T"]}],
  "nodes": [
    {"op": "gather", "inputs": ["token_embedding.table", "tokens"], "output": "emb"},
    {"op": "conv1d", "inputs": ["emb", "conv_1.kernel", "conv_1.bias"], "output": "c1",
     "size": 3, "dilation": 1, "activation": "relu", "input_quantization": "tensor_phases"}
  ],
  "outputs": [{"name": "slots", "node": "slots"}]
}
```

- `symbols`: size symbols and the largest value of each. The caller binds each (0 to its
  largest) before a run; an input may not come out empty.
- `plan` (optional): the symbol values a session plans its memory for, each symbol's largest by
  default. Set it when symbols trade off: a decoder's past `P` and new `T` add up to at most its
  cache's length, so it plans with `P` 0 and `T` the length. A bind whose sizes would need more
  memory than planned is refused.
- `inputs`: `dtype` `int32` or `float32`; `shape` lists whole numbers or symbols.
- `states` (optional): float32 tensors with whole-number shapes that a session keeps across
  runs, such as a key/value cache. `rayo_session_reset` zeroes them. A session may hold
  fewer rows than declared (`rayo_session_options.state_rows`, a decoder's context) and keep
  a key/value cache in int8 (`RAYO_CACHE_INT8`, [OPS.md](/docs/rayo/ops/) `cache_write`).
- `nodes`: run in order. `inputs` name graph inputs, states, earlier nodes' outputs, or
  tensors of the file; the other fields are the op's attributes. An attribute that is a size
  may be a whole number or a symbol's name.
- `outputs`: which nodes the caller reads, as float32.

Shapes are row-major, outermost first: a sequence of `T` vectors of size `C` is `[T, C]`.

## Ops

Each node's `op` is one of rayo's built-in ops, documented with its attributes, shapes and
int8 behaviour in [docs/OPS.md](/docs/rayo/ops/), or one the program gave rayo when it loaded the model
(`include/rayo/op.h`). A graph that names any other op fails to load, naming it.

## A decoder

A transformer decoder (the Ask writer's graph, for example) decodes token by token with a
key/value cache per layer:

```json
"symbols": {"T": 64, "P": 63}, "plan": {"P": 0},
"inputs": [{"name": "tokens", "dtype": "int32", "shape": ["T"]}],
"states": [{"name": "keys_0", "dtype": "float32", "shape": [64, 128]}, ...],
"nodes": [
  {"op": "range", "inputs": [], "output": "pos", "start": "P", "size": "T"},
  ...
  {"op": "cache_write", "inputs": ["keys_0", "k0"], "output": "ks0", "at": "P"},
  {"op": "attention", "inputs": ["q0", "ks0", "vs0"], "output": "h0", "heads": 4, "causal": 1},
  ...
]
```

Reset, run the prompt with `P = 0, T = n`, then each new token with `T = 1` at `P = n, n+1, ...`.

## Versions

A change that older rayo versions would misread bumps `graph.version`; rayo refuses a version
it does not read, and a graph with an op it does not know, naming it. New ops and attributes
with defaults that keep the old meaning do not bump it.
