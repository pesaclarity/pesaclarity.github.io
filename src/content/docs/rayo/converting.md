---
title: "Converting a model"
description: "rayo-convert reads a TFLite model (or an ONNX one) and writes a rayo model: a PCWT file (FORMAT.md) with the weights and the graph that runs them, in rayo's ops (OPS.md)."
section: "rayo"
order: 16
repo: "rayo"
path: "docs/CONVERTING.md"
commit: "1e536df33c3d0a50b180b7431be52ed9838ebff2"
source: "https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/docs/CONVERTING.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/CONVERTING.md"
---
`rayo-convert` reads a TFLite model (or an ONNX one) and writes a rayo model: a PCWT file
([FORMAT.md](/docs/rayo/format/)) with the weights and the `graph` that runs them, in rayo's ops
([OPS.md](/docs/rayo/ops/)). It maps ops by itself, fuses what rayo runs as one op, rewrites causal
self-attention so a decoder runs token by token with a key/value cache, and refuses what rayo
cannot run, naming each op, its index in the source and why.

It also converts a Hugging Face decoder-only **language model** (a directory with
`config.json`, `*.safetensors` and `tokenizer.json`): see [Language models](#language-models).

It is Python, outside the C library, in [`convert/`](https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/convert). It needs NumPy alone for
language models; the `tflite` package (the flatbuffers code generated from TFLite's schema)
for TFLite files, `onnx` for ONNX, and `jinja2` to write a language model's chat template.
Never TensorFlow or torch.

```sh
pip install "./convert[tflite]"  # "./convert[onnx]", "./convert[chat]"; or from git:
pip install "rayo-convert @ git+https://github.com/pesaclarity/rayo@<commit>#subdirectory=convert"
rayo-convert model.tflite -o model.weights
```

It prints what it decided (`note: ...`) and the graph's size. With `--graph` it prints the
graph too.

## Two real examples

Pesa Clarity's Ask reader and writer, as the app shipped them (`tests/ask/*.tflite`):

```sh
rayo-convert tests/ask/ask-reader.tflite -o ask-reader.weights --name ask-reader \
  --split-input question=tokens:96,shapes:96 --outputs slots,intent
rayo-convert tests/ask/ask-writer.tflite -o ask-writer.weights --name ask-writer \
  --rename output_0=logits
```

- The reader's one input `[1, 192]` (token ids, then shape ids) is presented as two,
  `tokens` and `shapes`; its length becomes the symbol `T` (at most 96). Its convolutions
  (one dilated, as TFLite writes it) become `conv1d`; the masked pooling stays as the model
  wrote it (`mul`, `reduce`, `div`, `maximum`). Every label is TFLite's on the 30 recorded
  questions, probabilities within 4.3e-5 (the hand-written graph's figure).
- The writer's three attention blocks are rewritten for a key/value cache: it decodes word by
  word, `P` positions run before and `T` new ones each run, and gives the last position's
  logits. Its logits are bit for bit those of the hand-written graph at every one of the 2243
  steps of the 172 recorded replies, so every reply the app records is TFLite's, and a reply
  takes about 1 ms on a host core, as before.

`tool/ci/convert.sh` (in `tool/check` and CI) converts both and runs rayo's C tests on them.

## Options

| Option | |
| --- | --- |
| `-o FILE` | the rayo model to write (default: the source's name with `.weights`) |
| `--name NAME` | the model's name in the file (`rayo_model_name`); the file's stem by default |
| `--split-input NAME=PART:SIZE,...` | present input `NAME` as several inputs, cut along its last axis. Every op reading it must be a slice within one part |
| `--outputs A,B` | the outputs kept, in this order (source names: TFLite's signature names) |
| `--rename OLD=NEW,...` | rename inputs and outputs |
| `--sequence auto\|none\|NAMES` | the inputs whose length becomes the size symbol `T`. `auto`: every int32 (or int64) input of shape `[1, L]` when they all have one length |
| `--decode auto\|on\|off` | rewrite causal self-attention for token-by-token decoding. `auto`: when the model has it |
| `--positions last\|all` | what a decoder gives: the last new position (default) or every new one |
| `--no-attention` | do not recognise attention; convert its ops one by one |
| `--input-shape NAME=1,64` | an input's shape where the file leaves sizes open |
| `--metadata JSON` | the file's `metadata` object |
| `--weights float32\|int8` | `float32` (default): the weights as the source holds them, a TFLite dynamic-range model's int8 included. `int8`: the float32 weights quantised by the converter ([below](#int8-from-float-graphs---weights-int8)) |
| `--int8-tensors CLASSES` | with `--weights int8`: which weights, by class: `dense`, `conv1d`, `embedding`, comma-separated, or `all` (default) |
| `--int8-min-size N` | with `--weights int8`: weights with fewer than `N` values stay float32 (default 1024, TFLite's converter's threshold) |

From Python: `rayo_convert.convert_file(path, rayo_convert.Options(...))` gives the file's
bytes, the graph, the weights and the notes; `Options(weights="int8", int8_tensors=(...),
int8_min_size=...)` are the int8 options.

## What it does

1. **Reads** the model into one graph of ops with TFLite's meaning (ONNX's ops are translated
   to theirs) and refuses at once any op it does not know, listing every one.
2. **Folds constants**: every op whose inputs are constants is computed once (shape
   arithmetic, a Tensordot's dynamic reshape, a position embedding's slice, a mask built
   from `RANGE` and comparisons).
3. **Finds every tensor's shape** by running the graph once with NumPy
   (`rayo_convert.ref`, a reference interpreter with TFLite's meaning for each op, int8
   included).
4. **Drops the batch.** rayo holds each tensor without its leading ones (`[1, T, C]` is
   `[T, C]`), which changes no broadcast. Reshapes that only add or drop leading ones go.
5. **Fuses** (below), then **recognises attention** (below).
6. **Lowers** each op to rayo's, in one of three modes, the first that fits:
   - `decode`: the sequence inputs' length is `T` and the positions run before are `P`; each
     attention keeps its keys and values in graph states (`cache_write`), and the outputs are
     the last new position's (`last_row`, moved before the ops that work on each row alone, so
     a decoder's final norm and logits run on one row). Every op must work on each position
     alone, except the recognised causal attention.
   - `sequence`: the length is the symbol `T`, the whole sequence run at once; every op must
     be expressible for any `T` (reshapes keep the sequence axis, constants along it are
     looked up by position).
   - `fixed`: every size as in the source.

   When an op does not fit a mode the converter says which and why, and takes the next.
7. **Writes** the file: format version 1, the source's name, SHA-256 and size, the tensors in
   the order the graph first uses them, the graph.

Weights are named after the source's layers: TFLite keeps Keras' scopes in its tensor names
(`model_1/conv_1_1/convolution` is the kernel of `conv_1`; Keras 3's `_1` suffixes are taken
off), so a file reads `conv_1.kernel`, `conv_1.bias`, `token_embedding.table`,
`ln_0_a.gamma`, `attention_0.query.kernel`.

## Ops

### TFLite

| TFLite | rayo |
| --- | --- |
| `FULLY_CONNECTED` | `dense` (constant kernel; its bias, a following `ADD` of a constant bias, and `RELU` or `GELU` fused); `matmul` with a computed kernel |
| `CONV_2D` over one row (`[1, 1, T, C]`, kernel `[O, 1, k, C]`, stride 1, same padding, odd reach) | `conv1d` |
| `SPACE_TO_BATCH_ND`, `CONV_2D` (valid), `BATCH_TO_SPACE_ND` (a dilated Keras `Conv1D`) | `conv1d` with `dilation` |
| `GATHER` (axis 0, constant table), `EMBEDDING_LOOKUP`, `DEQUANTIZE` after it | `gather` |
| `ADD`, `SUB`, `MUL`, `DIV`, `MAXIMUM`, `MINIMUM`, `SQUARED_DIFFERENCE` (fused activations too) | the same names |
| `NEG`, `ABS`, `SQUARE`, `SQRT`, `RSQRT`, `EXP`, `LOG`, `TANH`, `LOGISTIC`, `RELU`, `RELU6`, `GELU` | `neg`, ..., `sigmoid`, `relu`, `relu6`, `gelu_erf` / `gelu_tanh` |
| `SOFTMAX` (innermost axis; `beta` as a `mul`) | `softmax` |
| `MEAN`, `SUM`, `REDUCE_MAX`, `REDUCE_MIN`, `REDUCE_PROD` | `reduce` (one per axis) |
| the layer norm pattern below | `layer_norm` |
| `CONCATENATION` (innermost axis) | `concat` |
| `RESHAPE`, `EXPAND_DIMS`, `SQUEEZE` | `reshape`, or nothing when only leading ones change |
| `TRANSPOSE` | `transpose` (read only by slices: each slice taken first) |
| `STRIDED_SLICE` (step 1), `SLICE`, `SPLIT`, `SPLIT_V` | `slice` |
| `BATCH_MATMUL` | `matmul`, or `attention` (below) |
| `GREATER`, `GREATER_EQUAL`, `LESS`, `LESS_EQUAL`, `EQUAL`, `NOT_EQUAL` against a number; `CAST` of the result to float | `compare` (rayo's comparisons give float 0 or 1) |
| `SELECT`, `SELECT_V2` with a constant condition and one constant side | `mul` and `add` |
| `SELECT_V2(LESS(i, 0), ADD(i, n), i)` before a lookup | nothing: rayo refuses an id outside the table instead of wrapping it |
| `SHAPE`, `PACK`, `FILL`, `RANGE`, `TILE`, `BROADCAST_TO`, `ZEROS_LIKE`, ... | folded when their inputs are constants |

Refused, each with the reason: 2-D convolutions and pooling, depthwise convolutions,
strides, valid padding outside the dilated form, `PAD`, recurrent ops, control flow,
`QUANTIZE` (fully int8 models: rayo's activations are float32), `CAST` between number types,
selects and comparisons between two computed tensors, tensors of rank above 4, and custom ops
(write them as rayo ops of your own, `include/rayo/op.h`).

### ONNX (float32, opset 13 or later)

`Gemm` and `MatMul` with a constant weight (to `dense`), `MatMul` (`matmul` or `attention`),
`Conv` 1-D with same padding (channels first: transposed to rayo's `[T, C]` around
`conv1d`), `Add`, `Sub`, `Mul`, `Div`, `Max`, `Min`, `Relu`, `Tanh`, `Sigmoid`, `Exp`,
`Log`, `Sqrt`, `Neg`, `Abs`, `Gelu`, `Erf` in PyTorch's GELU pattern
(`x * 0.5 * (1 + erf(x / sqrt 2))`), `Softmax` (last axis), `LayerNormalization` (last
axis), `BatchNormalization` (as `mul` and `add`), `Gather`, `Concat`, `Reshape`, `Flatten`,
`Squeeze`, `Unsqueeze`, `Transpose`, `Slice`, `Split`, `ReduceMean` and the other
reductions, comparisons, `Where`, `Clip` (PyTorch's `clamp`: `maximum` and `minimum`),
`Cast`, `Identity`, `Dropout`, and, folded, `Shape`, `ConstantOfShape`, `Range`, `Expand`,
`Trilu`, `Tile`, `Constant`. int64 ids become int32. Transposes move past the elementwise
ops after them (both inputs of a binary one, when they are transposed alike) and go where a
later one undoes them, so PyTorch's channels-first `Conv1d` between layers that work on
`[T, C]` (with ReLUs and residual adds between) leaves no transpose, and each ReLU fuses into
its convolution. Quantised
ONNX ops (`QLinear*`, `MatMulInteger`) are refused: for int8, convert the float graph with
`--weights int8` ([below](#int8-from-float-graphs---weights-int8)).

Weights are named after their layers as for TFLite: from an initializer's name when it is a
PyTorch parameter's (`conv_1.weight` is layer `conv_1`), otherwise from the scope PyTorch's
exporter gives the node that reads it (`/slot_hidden/MatMul`, reading `onnx::MatMul_7`, is
layer `slot_hidden`). So a torch module with the Keras model's layer names gives a file with
the same names: `conv_1.kernel`, `slot_hidden.bias`, `token_embedding.table`, `ln.gamma`.

## int8: TFLite's dynamic-range models

rayo runs int8 weights as TFLite's hybrid kernels do (OPS.md, "Linear layers"), so a
converted model gives TFLite's numbers. Per op:

- **`FULLY_CONNECTED`** with an int8 constant kernel: each row of the input quantised alone,
  asymmetrically (TFLite's `asymmetric_quantize_inputs`, its default since 2.6), to `dense`
  with `input_quantization: rows`. A kernel quantised symmetrically on the fly
  (`asymmetric_quantize_inputs` false) is refused; so is a kernel with a scale per input.
- **`CONV_2D`** with an int8 kernel: the input quantised as one tensor (one per batch item);
  the `SPACE_TO_BATCH_ND` form quantises each of its phases alone. Both are `conv1d`'s
  `tensor_phases`. A native dilated int8 `CONV_2D` (one scale for the whole input) is refused,
  since rayo's dilated `conv1d` quantises per phase.
- **`GATHER`** of an int8 table with one scale: `gather` dequantises each row as it reads it.
  A table with a scale per row is stored dequantised, as float32 (noted).
- **`DEQUANTIZE`** of a constant (weight-only quantisation) is folded to float32, which is
  what TFLite computes with; of a lookup it is nothing.
- **`BATCH_MATMUL`** with an int8 weight is refused (TFLite's hybrid kernel for it is not
  rayo's).

Splitting an int8 dense layer's rows (one `qkv` projection into query, key and value) keeps
its products: each row of the input is quantised the same way for each part.

## int8 from float graphs: `--weights int8`

```sh
rayo-convert reader.onnx -o reader.weights --weights int8              # every class
rayo-convert reader.onnx -o reader.weights --weights int8 --int8-tensors dense,conv1d
```

The converter quantises a float32 graph's weights itself (`rayo_convert/quantise.py`), into
the same int8 a TFLite dynamic-range model holds, so the scheme lives in one place, the
files run on the kernels above and the app's Dart reader reads them unchanged. Mainly for
ONNX graphs exported from PyTorch; a float32 TFLite file works the same way.

| Class | The weight | Its int8 | The input, as the layer runs |
| --- | --- | --- | --- |
| `dense` | `Gemm`, `MatMul` with a constant weight (`FULLY_CONNECTED`): kernel `[out, in]` | one scale per output (axis 0) | each row alone, asymmetric (`input_quantization: rows`) |
| `conv1d` | 1-D `Conv` (`CONV_2D` over one row): kernel `[out, 1, size, in]` | one scale per output (axis 0) | the whole tensor, a dilated convolution's each phase alone (`tensor_phases`) |
| `embedding` | `Gather` along axis 0 of a constant `[rows, width]` table | one scale for the table | none: each row dequantised as it is read |

- **Weights:** symmetric, zero point 0. `scale = max |w| / 127` over what shares a scale (1
  where every value is 0), `q = round(w / scale)`, halves away from zero, so the largest
  magnitude is ±127. Scales are float32, stored as for TFLite's files (FORMAT.md).
- **Activations:** quantised on the fly by rayo's kernels, as for TFLite's hybrid ones
  (OPS.md, "Linear layers"): nothing about them is in the file but `input_quantization`.
- **What stays float32:** weights with fewer than `--int8-min-size` values (1024 by default,
  so the same tensors as TFLite's converter: a small table or the last dense of a head); the
  classes left out of `--int8-tensors`; a weight also read by an op that is not of its class
  (noted); biases, norms, and `matmul` weights. The notes list each.
- **Deterministic:** NumPy alone, no state; the same graph gives the same bytes.

The reference (`rayo_convert.ref`) gives each quantised op this meaning (for a dilated
convolution, each phase quantised alone, as rayo's `conv1d` does), and the tests
(`convert/tests/test_int8.py`) check it three ways:

- **Against the reference**, on a model with the message reader's and the Ask reader's op
  families as PyTorch exports them (an embedding, channels-first convolutions, one dilated by
  4 and residual, layer norm, masked mean pooling with `Clip`, dense heads): the int8 weights
  are the reference's, and at least 99% of rayo's output values are within 1e-5 of it
  (measured over 203 questions: 99.96%, the rest 1.8e-2 at most). The others are where an
  activation lands on a rounding boundary of the on-the-fly quantisation: rayo sums in
  float32 and the reference in float64, so one of them can take the next int8 value, one step
  of that layer's input scale. In float32 every value is within 1e-5 (measured 1.8e-6).
- **Against the TFLite path**: the released Ask reader and writer (`tests/ask/*.tflite`), with
  their int8 weights turned back into floats and quantised again by `--weights int8`, give
  the file the TFLite conversion gives, byte for byte: every int8 value, every scale (the
  same float32), every float32 tensor kept, the graph. So rayo, and the Dart reader, compute
  with them exactly as with today's files.
- **Against the float model** (ONNX's own evaluator): the same labels; probabilities within
  2e-2 (measured 1.7e-2 at worst over 203 questions of a model with random weights), int8's
  error.

A dilated convolution in a float graph (ONNX's `Conv` with `dilations`) quantises each phase
alone, as rayo's `conv1d` does; TFLite's own native dilated int8 `CONV_2D`, which quantises
the whole input, stays refused.

## Fusions

Each fires only when it computes what the source ops compute, as rayo implements them;
otherwise the ops are converted one by one.

- **Dense, bias, activation**: `FULLY_CONNECTED` (activation none) followed by the `ADD` of a
  constant `[out]` (a Tensordot's bias; its fused `RELU` too), or by `RELU`, or by `GELU`
  (exact, not `approximate`), read by nothing else.
- **1-D convolution**: `CONV_2D` over `[1, 1, T, C]` as above.
- **Dilated convolution**: `SPACE_TO_BATCH_ND(block [d], paddings [[p, q]])`, an
  `EXPAND_DIMS` or `RESHAPE`, `CONV_2D` (valid, stride 1, kernel `[O, 1, k, C]`), a `RESHAPE`
  or `SQUEEZE`, `BATCH_TO_SPACE_ND(block [d], crops [[0, e]])` and the bias `ADD`, where
  `p = (k - 1) d / 2` and the output is as long as the input (a same-padded dilated
  convolution, centred). Anything else is noted and refused.
- **Layer norm**, TFLite's decomposition of Keras' `LayerNormalization`:
  `mean = MEAN(x, -1)`, `var = MEAN(SQUARED_DIFFERENCE(x, mean), -1)`,
  `m = RSQRT(var + eps) * gamma`, `y = x * m + (beta + NEG(mean) * m)`; and the plain
  `(x - mean) * RSQRT(var + eps) * gamma + beta`. Both over the innermost axis, with
  `keep_dims`, eps a constant, gamma and beta constants of the axis' size (or absent), every
  intermediate read only inside. rayo's `layer_norm` follows the first form's arithmetic.

## Attention: the rewrite for decoding

A TFLite (or ONNX) file holds a causal transformer as a whole-sequence graph: every step
would run every position again. The converter recognises scaled dot-product self-attention
and rewrites it into rayo's `attention` and `cache_write` with graph states, so a decoder
runs one token per step with a key/value cache.

### The shapes recognised

From a `SOFTMAX`, the converter walks:

- **back** to the scores: any number of `MUL` or `DIV` by a constant that is one number
  throughout (the scale), `ADD` of a constant (a mask), `SELECT_V2(constant condition, scores,
  constant number)` (a mask), to one `BATCH_MATMUL(q, k)` (`adj_x`, `adj_y` either way);
- **forward**: optionally a `MUL` of the weights by a constant (Keras multiplies by the mask's
  ones), then `BATCH_MATMUL(weights, v)`, then any `TRANSPOSE`, `RESHAPE`, `SQUEEZE` or
  `EXPAND_DIMS` back to one tensor;
- **from q, k and v back to their projections**: through `RESHAPE`, `TRANSPOSE`,
  `STRIDED_SLICE`, `SLICE`, `SPLIT`, `SPLIT_V`, `SQUEEZE`, `EXPAND_DIMS`, `GATHER` of constant
  indices (and ONNX's `Reshape`, `Slice`, `Split`, `Squeeze`, `Unsqueeze`, `Identity`), and
  `MUL` or `DIV` by one number (Keras' MultiHeadAttention scales the query), to a tensor
  `[.., T, F]`.

Rather than matching op names in a fixed order, it **traces indices**: it runs the
projection's row and column numbers through those ops (with the reference) and reads, for
each head and dimension of q, k and v, the projection column it is and whether every query row
is its own position. So these all fit, and any other layout of the same kind:

- one `qkv` dense, `RESHAPE [1, T, 3, H, d]`, `TRANSPOSE [2, 0, 3, 1, 4]`, a `STRIDED_SLICE`
  each (a custom Keras layer; the Ask writer);
- Keras' `MultiHeadAttention`: three denses, each `RESHAPE [1, T, H, d]` and
  `TRANSPOSE [0, 2, 1, 3]`, the query scaled, `SELECT_V2` or `ADD` masks, the weights
  multiplied by the mask;
- PyTorch's export: one `MatMul` and `Add`, `Split` in three, `Reshape`, `Transpose` (the
  keys to `[0, 2, 3, 1]`), `Div` by sqrt(d), `Where(mask, scores, -inf)`.

### The conditions checked

- **Shapes**: the heads come in one batch dimension; q, k and v have the same number of
  heads and the same head size `d` (rayo's attention gives v's size per head as q's); as many
  values as keys; every query row of q, and every key row of k and v, is the position of its
  row in the projection, in order; each head's columns are distinct.
- **Scale**: the product of every scaling on the path (and softmax's `beta`) is one positive
  finite number. When it is `1 / sqrt(d)` in float32 the node uses rayo's default; otherwise
  it carries `scale`.
- **Mask**: the masks added (and selected), scaled as the path scales them, broadcast to the
  scores `[H, T, S]`: every value is 0 (seen) or at most -10⁴ (hidden: its weight is exactly
  0 in float32, as rayo gives it), the same for every head. Seen exactly where key `j ≤`
  query `i` (with the queries at the last `T` of `S` keys) is **causal**; seen everywhere is
  **not causal**. Anything else is declined. A multiplication after the softmax must be by
  1 where seen and 0 where hidden.
- **Use**: every tensor inside the block is read only inside it.
- **Projections**: each of q, k and v is either the projection's columns in order, or columns
  of a dense layer's output; that dense is split into one per role, of those rows (exact,
  above). The heads must come back side by side, head by head, as rayo's attention gives them;
  in another order only into a dense layer, whose kernel's columns are then permuted.
- **Decoding** (the `decode` mode) also needs: the attention causal; q, k and v all of the
  one sequence (self-attention, not attention to another input); and every other op of the
  model working on each position alone (dense layers, layer norms, elementwise ops, lookups,
  reshapes that keep the sequence axis, a softmax not over positions). A constant added along
  the sequence (a position embedding) becomes a lookup of the positions `P .. P + T - 1`.

### What happens otherwise

- A block that is attention but **not causal** (an encoder) is `attention` with `causal: 0`,
  and the model runs the whole sequence at once (mode `sequence`); with `--decode on` the
  converter says the rewrite was declined and why.
- A block that is **not exactly rayo's attention** (a mask of -1, a scale that varies, a
  padding mask from an input, extra ops in the path) is noted, `attention not rewritten:
  <why>; its ops are converted one by one`: `matmul`, `mul`, `add`, `softmax`, `transpose`,
  `reshape`, `slice`. This is the whole-sequence graph (every position recomputed at each
  step), with the source's numbers. A transpose read only by slices (the fused `qkv` layout's
  `[3, 1, H, T, d]`, a rank rayo cannot hold) becomes, per slice, the slice of its input and a
  transpose of that. If an op cannot be converted at all, the conversion fails, naming it.
  The Ask writer converted so (`--no-attention`) still gives TFLite's next token at every
  recorded step, at about 5 ms a step instead of 0.09 ms with the cache.
- **When decoding is declined** for any reason, the note says why and the graph runs the
  whole sequence: bind `T` to the tokens so far and run them all at every step, reading the
  last row. Never a silent rewrite: the converter rewrites only what passes every check above.

### Running a converted decoder

```c
rayo_session_reset(s);
rayo_session_bind(s, "P", 0, NULL);
rayo_session_bind(s, "T", n, NULL);      /* the prompt */
/* write the n ids, run, read the logits of the last position */
rayo_session_bind(s, "P", n, NULL);
rayo_session_bind(s, "T", 1, NULL);      /* then one token per run at P = n, n + 1, ... */
```

The graph's `symbols` are `T` (at most the source's length) and `P` (at most one less), its
`plan` is `P = 0`, its `states` a `[length, D]` keys and values pair per attention.

## Checking a conversion

`rayo_convert.ref.run(graph, feeds)` runs the source graph in NumPy, with TFLite's meaning,
int8 included; `rayo_convert.runtime` builds rayo's C library from a checkout and runs a
converted file (`Session.bind`, `run`, `output`), as the tests do
(`convert/tests/`): every synthetic model is checked against the reference, the ONNX ones
against ONNX's own reference evaluator, the int8 ones from float graphs as above, and the Ask
models against TFLite's recordings.

## Language models

```sh
pip install "./convert[chat]"         # NumPy and jinja2
rayo-convert SmolLM2-135M-Instruct/ -o smollm2-135m.weights --weights q4 --context 2048
```

The directory is a Hugging Face model as downloaded: `config.json`, `model.safetensors` (or
shards with `model.safetensors.index.json`), `tokenizer.json`, and, when it has them,
`tokenizer_config.json` and `generation_config.json`. The safetensors are read with NumPy
(float32, float16 or bfloat16), one tensor at a time, so converting takes about one tensor's
memory.

**What is read from config.json**, and nothing else: the layers, the hidden size, the heads and
key/value heads, the head size (`head_dim`, or hidden / heads), the feed-forward size, the
vocabulary, the norm's `rms_norm_eps`, `hidden_act` (silu, gelu, gelu_pytorch_tanh), the
rotary embedding's `rope_theta`, `partial_rotary_factor` and `rope_scaling` (none, linear,
llama3, dynamic), `tie_word_embeddings`, and `max_position_embeddings`. The tensors are found
by the names the Llama family uses (`model.layers.{i}.self_attn.q_proj.weight`, ...), which
Llama, Mistral, Qwen2, SmolLM and others share; optional q, k and v biases (Qwen2) are used
when they are there, and fused `qkv_proj` and `gate_up_proj` tensors (Phi-3) are split.
Anything else (an op rayo has none for, a scaling that depends on the length, a sliding window
shorter than the context, logit soft-capping, a norm with a bias) is refused, naming it.

**What is written:**

- the graph: `gather`, then per layer `rms_norm`, three `dense`, two `rope`, two
  `cache_write`, `attention` (grouped-query), `dense`, `add`, `rms_norm`, two `dense`,
  `swiglu`, `dense`, `add`; then `last_row`, `rms_norm` and the output `dense` (the embedding
  again when it is tied). Symbols `T` (new tokens a run, at most `--chunk`) and `P` (tokens in
  the cache); the cache's states hold `--context` positions of the key/value heads.
- the weights: every matrix as `--weights` says (`q4`: int4 groups of 32, the
  [FORMAT.md](/docs/rayo/format/) layout; `int8`: one scale per row; `float32`), the norms and biases
  in float32, the rotary frequencies as a float32 weight;
- the metadata: the shapes, the stop tokens (`eos_token_ids`), `bos_token_id`,
  `add_bos_token`, and `chat_turns`: the model's own chat template (from
  tokenizer_config.json) rendered by jinja2 around marker texts and cut into the pieces before
  and after each turn, so a C program applies the template with no template engine;
- `MODEL.tokenizer.json`, a copy of tokenizer.json, which rayo's tokeniser reads
  (`include/rayo/text.h`).

| Option | |
| --- | --- |
| `--weights q4\|int8\|float32` | the matrices' form (default q4) |
| `--context N` | the longest context, in tokens (default 2048, at most the model's own); the cache is planned for it |
| `--chunk N` | the most prompt tokens one run takes (default 64) |
| `--positions last\|all` | the last position's logits (default; what generation needs) or every one's |
| `--name`, `--metadata` | as for TFLite models |

The tests (`convert/tests/test_hf.py`) build tiny random Llama-style models in the test, write
them as Hugging Face directories, convert them and compare rayo's logits with a NumPy
reference written from the models' definition (`convert/tests/llama_ref.py`): float32 within
2e-5 at every position, with and without the cache, with Qwen2's biases, fused projections,
an untied head, gelu, and bfloat16 files; int8 and q4 with the same next token at the fixed
prompts. `convert/tests/test_tokenizer.py` compares rayo's tokeniser with the tokenizers
library on tokenizer.json files it trains on synthetic text.
