---
title: "Ops"
description: "Every op a graph can name (docs/FORMAT.md), with its inputs, attributes, output, and what it does with int8 weights (CONVERTING.md says which TFLite and ONNX ops become which)."
section: "rayo"
order: 18
repo: "rayo"
path: "docs/OPS.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/OPS.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/OPS.md"
---
Every op a graph can name (docs/FORMAT.md), with its inputs, attributes, output, and what it
does with int8 weights ([CONVERTING.md](/docs/rayo/converting/) says which TFLite and ONNX ops become
which). A program can add its own ops through `include/rayo/op.h` (see the
end of this page). `rayo_op_builtin(i)` lists the built-in ones at run time.

Notes for every op:

- Shapes are row-major, outermost first, and have at most `RAYO_MAX_RANK` dimensions (4 by
  default; `include/rayo/config.h`).
- Activations are float32 unless an op says otherwise.
- An input is either an activation (a graph input, a state, or an earlier node) or a weight
  (a tensor of the file). Each op says which inputs must be weights.
- A *size* attribute is a whole number from 0 to `RAYO_MAX_DIM`, or the name of a size
  symbol, which is read at each run.
- Every op checks its inputs when the model loads (`prepare`) and at every bind (`infer`),
  and fails with a message that names the node. A run allocates nothing.

## Elementwise

### Binary: `add`, `sub`, `mul`, `div`, `maximum`, `minimum`, `squared_difference`

| | |
| --- | --- |
| Inputs | a, b: float32. Either may be a float32 weight (a bias, a scale, a mask) |
| Output | the broadcast shape: `a + b`, `a - b`, `a * b`, `a / b`, the larger, the smaller, `(a - b)²` |

Shapes broadcast as NumPy's do: aligned at the innermost dimension, a missing dimension or a
dimension of 1 repeating. Each value is one float32 operation, as TFLite's float kernels.

### Unary

`neg`, `abs`, `square`, `sqrt`, `rsqrt` (`1 / sqrt(x)`), `exp`, `log`, `tanh`, `sigmoid`
(`1 / (1 + exp(-x))`), `relu`, `relu6` (`min(max(x, 0), 6)`), `gelu_erf`
(`0.5 x (1 + erf(x / sqrt 2))`), `gelu_tanh` (`0.5 x (1 + tanh(sqrt(2 / pi) (x + 0.044715
x³)))`) and `silu` (`x / (1 + exp(-x))`, also called swish).

| | |
| --- | --- |
| Inputs | x: float32 |
| Output | x's shape, the function of each value |

`exp`, `sqrt`, `rsqrt` and `gelu_erf` are rayo's float maths (`src/core/mathx.c`); `log`,
`tanh`, `sigmoid`, `gelu_tanh` and `silu` are C89's double functions rounded to float.

### `swiglu`

| | |
| --- | --- |
| Inputs | gate, up: float32 activations of one shape |
| Output | their shape: `silu(gate) * up` |

The gated feed-forward layer of Llama-style models, in one pass. A model whose gate takes
another activation uses that unary op and `mul`.

### `compare`

| | |
| --- | --- |
| Inputs | x: float32 or int32 |
| Attributes | `comparison`: `greater`, `greater_equal`, `less`, `less_equal`, `equal` or `not_equal` (required). `value`: a number (default 0). `dtype`: of the output, `float32` (default) or `int32` |
| Output | x's shape: 1 where `x <comparison> value` holds, else 0 |

The comparison is made in double. A padding mask over token ids, where id 0 is padding, is
`{"op": "compare", "comparison": "greater", "value": 0}`.

### `softmax`

| | |
| --- | --- |
| Inputs | x: float32, rank 1 or more |
| Output | x's shape: the softmax over the innermost dimension (the maximum subtracted first) |

## Lookups and joins

### `gather`

| | |
| --- | --- |
| Inputs | table: a weight `[rows, width]`: float32; int8 with one scale or one per row; or int4 (groups along the row). ids: int32 `[n]` |
| Output | float32 `[n, width]`: row `ids[i]` of the table for each i |

An int8 or int4 table is dequantised as each row is read (`q * scale`), so a language
model's embedding can be the same 4-bit tensor as its output layer (a tied embedding: the
graph names one weight in both nodes, and the file holds it once). An id outside the table fails
the run with `RAYO_ERR_SHAPE`.

### `concat`

| | |
| --- | --- |
| Inputs | a `[..., p]`, b `[..., q]`: float32, equal outside the innermost dimension |
| Output | `[..., p + q]`: a's values, then b's |

## Reductions

### `masked_reduce`

| | |
| --- | --- |
| Inputs | x: float32. mask: float32, one value per position of the reduced axis |
| Attributes | `reduction`: `max`, `sum` or `mean` (required). `axis`: the axis reduced (default 0; negative counts from the end). `fill`: optional, see below. `empty`: the result where nothing counts (default 0) |
| Output | x's shape without the axis |

- **Which positions count:** a position is kept where its mask value is not 0. Without
  `fill`, the positions the mask drops are left out. With `fill`, each dropped position
  counts as the value `fill`.
- **`mean`:** the sum of the positions that count, divided by how many there are.
- **Nothing counts:** the result is `empty`.

Keras models often mask a max by subtracting a large number from the padding,
`max(x * m - (1 - m) * 1e4)`. For a 0/1 mask that is `"reduction": "max", "fill": -10000`,
bit for bit. A masked average, `sum(x * m) / max(sum(m), 1)`, is `"reduction": "mean"`.

### `reduce`

| | |
| --- | --- |
| Inputs | x: float32 |
| Attributes | `reduction`: `sum`, `mean`, `max`, `min` or `prod` (required). `axis`: default -1 (negative counts from the end). `keepdims`: 1 keeps the axis with size 1 (default 0) |
| Output | x's shape without the axis (or with it as 1) |

The values are combined in float32 in order along the axis, as TFLite's reference kernels do;
`mean` divides the sum by the count. A rank-1 input needs `keepdims`.

### `last_row`

| | |
| --- | --- |
| Inputs | x `[T, C]` |
| Output | `[C]`: row T - 1 |

## Moving values

These take float32 or int32 and copy; none computes.

### `reshape`

| | |
| --- | --- |
| Inputs | x |
| Attributes | `shape`: a list of sizes (whole numbers or size symbols) with at most one -1, the size that makes the count match |
| Output | x's values in that shape |

### `transpose`

| | |
| --- | --- |
| Inputs | x |
| Attributes | `perm`: dimension i of the output is dimension `perm[i]` of x |
| Output | x's values, dimensions reordered |

### `slice`

| | |
| --- | --- |
| Inputs | x |
| Attributes | `begin`, `size`: a size per dimension (whole numbers or size symbols; a size of -1 is the rest of that dimension) |
| Output | the block of x from `begin` of `size` |

## Linear layers

`dense` takes float32, int8, int4 or int3 kernels; `conv1d` float32 or int8.

**Float32 kernels:** the product is plain float32.

**int8 kernels** are symmetric, with one scale per output or one scale in all. They run as
TFLite's dynamic-range ("hybrid") kernels do, so a model exported from TFLite gives TFLite's
numbers:

1. **Quantise the input.** The float input is quantised to int8 on the fly, asymmetrically,
   as TFLite's `AsymmetricQuantizeFloats` does. The range is widened to include 0, and
   halves round away from zero. A range that is not finite quantises to zeros. The parts
   quantised together depend on the op's `input_quantization`.
2. **Multiply.** The products are summed exactly in int32. That is why a kernel's inner
   dimension is limited to `RAYO_I32_MAX / (256 * 128)`.
3. **Dequantise.** `y = bias + (acc - zero_point * rowsum(kernel)) * input_scale *
   kernel_scale`, then the activation.

**int4 and int3 kernels** (weight-only, group-wise, with float32 or float16 scales; the
layouts are in [FORMAT.md](/docs/rayo/format/)) run as language-model runtimes run 4-bit weights:

1. **Quantise the input.** Each row of the input is quantised to int8, symmetrically, one
   scale per group of 32: `scale = max |x| / 127`, `q = x * 127 / max |x|`, rounded half away
   from zero.
2. **Multiply.** Per group, the products of the int8 inputs and the 4-bit weights (-8 to 7)
   or 3-bit ones (-4 to 3) are summed exactly in int32, four at a time; each sum of four is
   converted to float, multiplied by `input_scale * weight_scale` and added into one of
   eight lanes. A float16 scale is converted to float32 exactly first.
3. **Add up** the lanes as `((l0 + l1) + (l2 + l3)) + ((l4 + l5) + (l6 + l7))`, then the bias
   and the activation.

Every kernel (generic C, SSE4.1, AVX2, NEON, SDOT), for 4 and 3 bits and both scale types,
gives the same floats, bit for bit; the tests check it. The weights are read where they are in the file (mapped), with no copy.

`activation` is `none` (the default), `relu`, `gelu_erf` (`0.5 x (1 + erf(x / sqrt 2))`,
Keras' `gelu`) or `silu`. It is fused into the layer.

**Threads.** A session with threads (`rayo_session_create_with`) splits a dense layer's
outputs between them, and attention's heads. Every output is still one thread's sum in the
same order, so the results are the same with any number of threads.

### `dense`

| | |
| --- | --- |
| Inputs | x `[..., in]`; kernel: a weight `[out, in]`; bias: a weight `[out]` (optional) |
| Attributes | `activation`; `input_quantization`: `rows` (default), one scale and zero point per row of x |
| Output | `[..., out]`: `act(x · kernelᵀ + bias)` |

### `conv1d`

| | |
| --- | --- |
| Inputs | x `[T, C]`; kernel: a weight `[out, 1, size, C]` (TFLite's layout) or `[out, size, C]`; bias `[out]` (optional) |
| Attributes | `size`: the kernel's taps, which must match the kernel. `dilation`: default 1. `activation`. `input_quantization`: `tensor_phases` (default) |
| Output | `[T, out]`, same padding: tap j of position t reads position `t + (j - (size - 1) / 2) * dilation`, and positions outside the sequence read zeros |

- **Limits:** `(size - 1) * dilation` must be even, to keep the output centred, and below
  2^30.
- **`tensor_phases`:** the input is quantised with one scale for all of it. A dilated
  convolution quantises each of its `dilation` phases (the positions with `t % dilation ==
  p`) on its own, as TFLite does when it runs one as `SPACE_TO_BATCH_ND` and a convolution.
- **Padding:** positions outside the sequence count as float zeros, which is the zero point
  in int8.

### `matmul`

| | |
| --- | --- |
| Inputs | a `[..., M, K]`; b `[..., K, N]`, an activation or a float32 weight |
| Attributes | `transpose_a`, `transpose_b`: 1 reads a as `[..., K, M]` or b as `[..., N, K]` (default 0) |
| Output | `[..., M, N]` |

A float32 product of activations, such as attention's scores when a model is converted op by
op; the dimensions before the last two broadcast. Each sum is in float32, in order. For a
layer with weights use `dense`, which takes int8.

### `rms_norm`

| | |
| --- | --- |
| Inputs | x `[..., C]`; gamma: a float32 weight `[C]` |
| Attributes | `epsilon` (default 1e-6). `gamma_offset`: added to gamma (default 0; 1 for models that store gamma - 1) |
| Output | x's shape: `(gamma + gamma_offset) * (x * rsqrt(mean(x²) + epsilon))` over the innermost dimension |

The mean of the squares is summed in double; the rest is float32, in the order shown, as the
transformers library computes Llama's `RMSNorm`.

### `layer_norm`

| | |
| --- | --- |
| Inputs | x `[..., C]`; gamma, beta: float32 weights `[C]` |
| Attributes | `epsilon` (default 1e-5) |
| Output | x's shape, normalised over the innermost dimension |

It follows TFLite's arithmetic for Keras' `LayerNormalization`: the mean and the variance,
then `m = rsqrt(var + eps) * gamma`, then `x * m + (beta - mean * m)`.

## Sequences and decoding

### `range`

| | |
| --- | --- |
| Inputs | none |
| Attributes | `start`, `size`: sizes |
| Output | int32 `[size]`: start, start + 1, ... |

### `cache_write`

| | |
| --- | --- |
| Inputs | a state `[N, C]`; x `[T, C]` |
| Attributes | `at`: a size |
| Output | rows `0 .. at + T - 1` of the state, a view with no copy |

It writes x into rows `at .. at + T - 1` of the state. It is how a decoder keeps each
layer's keys and values across runs. `at + T` must be at most N.

**int8 cache.** A session created with `cache = RAYO_CACHE_INT8` keeps in int8 each state
that only `cache_write` nodes write (as their first input) and only `attention` nodes read
(as k or v). Each row is quantised as it is written, in groups of the attention's head size
(`width / kv_heads`): `scale = max |x| / 127`, `q = x * 127 / max |x|` rounded half away from
zero (a group of zeros: scale 0), as the int4 kernels quantise their inputs; a float32 scale
a group, after the rows. The output is then an int8 view. For SmolLM2-135M's shape the cache
is 12.2 KB a token instead of 46 KB. A state read by anything else stays float32.

### `rope`

| | |
| --- | --- |
| Inputs | x `[T, heads * H]`; positions: int32 `[T]` (a `range` from `P`); freq: an optional float32 weight `[R / 2]` |
| Attributes | `heads` (required). `rotary_dims` R (default H: the whole head; less for partial rotary embeddings). `style`: `half` (default) or `interleaved`. `theta` (default 10000), used when there is no freq. `attention_scaling` (default 1): multiplies cos and sin |
| Output | x's shape, each head's first R dimensions rotated |

- **The angle** of position p and pair i is `p * freq[i]`, a float32 product, as the models
  compute it; cos and sin are C89's, in double, rounded to float. Without the freq weight,
  `freq[i] = theta^(-2i / R)`.
- **`half`** (GPT-NeoX, Llama, Qwen: "rotate half") pairs dimension i with i + R/2:
  `y[i] = x[i] cos - x[i + R/2] sin`, `y[i + R/2] = x[i + R/2] cos + x[i] sin`.
  **`interleaved`** (GPT-J) pairs 2i with 2i + 1.
- **Scaling** (linear, Llama 3's, and the like) is in the freq weight, which a converter
  writes from the model's configuration, so rayo needs no code per scheme.

### `attention`

| | |
| --- | --- |
| Inputs | q `[T, heads * H]`; k, v `[S, kv_heads * H]` with S ≥ T |
| Attributes | `heads` (default 1). `kv_heads` (default `heads`; heads must be a multiple of it). `causal`: 0 or 1. `scale`: default `1 / sqrt(H)` |
| Output | `[T, heads * H]` |

- **Per head:** `softmax(q · kᵀ * scale) · v`. Each head uses its own H of the dimensions.
- **Grouped-query attention:** with `kv_heads` below `heads`, query head h reads key and value
  head `h / (heads / kv_heads)`, as the models repeat them (Llama 2 70B, Llama 3, Qwen,
  SmolLM). The cache then holds only the `kv_heads`.
- **Query positions:** the T queries are at positions `S - T .. S - 1`, so the earlier keys
  can come from a cache.
- **`causal`:** a query sees only the keys at or before its own position. A key it may not
  see gets weight 0, which is exactly what TFLite's `-1e9` mask gives in float32.
- **int8 k and v** (an int8 cache): the score of a key is `scale_g * sum(q[e] * k8[e])` over
  each group, in float32, and the output adds `(p_j * scale_g) * v8[e]`. On the tiny test
  model the logits stay within 1% of the largest of the float32 cache's, the most likely
  token the same at every position tested; on random 128-wide weights (rayo-convert's
  tests) within 3%.

## Ops of your own

`include/rayo/op.h` lets a program give rayo ops when it loads a model:

```c
static rayo_status scale_prepare(void *user, const rayo_op_node *node, const void **params,
                                 rayo_message *msg);
static rayo_status scale_infer(const void *params, const rayo_tensor_view *in, int n,
                               rayo_tensor_view *out, size_t *scratch, rayo_message *msg);
static rayo_status scale_run(const void *params, const rayo_tensor_view *in, int n,
                             rayo_tensor_view *out, void *scratch);

rayo_custom_op scale;
const rayo_custom_op *ops[1];
rayo_model_options options;
memset(&scale, 0, sizeof scale);
scale.api_version = RAYO_OP_API_VERSION;
scale.name = "scale";
scale.min_inputs = scale.max_inputs = 1;
scale.prepare = scale_prepare;
scale.infer = scale_infer;
scale.run = scale_run;
ops[0] = &scale;
memset(&options, 0, sizeof options);
options.ops = ops;
options.op_count = 1;
status = rayo_model_create_with(bytes, size, &options, &model, &msg);
```

- **prepare** reads the node's attributes (`rayo_op_node_int`, `_number`, `_string`) and
  its weights (`rayo_op_node_input`), and allocates its parameters with
  `rayo_op_node_alloc`, which lives as long as the model.
- **infer** sets the output's dtype and shape, and the scratch bytes a run needs.
- **run** computes the output. It must not allocate. The parameters are shared by every
  session, so anything a run changes belongs in `scratch`.
- **Rules:** an op's name may not be a built-in op's. It may take at most
  `RAYO_OP_MAX_INPUTS` inputs (16 by default). rayo refuses an op written for another
  `RAYO_OP_API_VERSION`.
- **Unknown ops:** a graph that names an op neither rayo nor the program has fails to load,
  with the op's name in the message.
- **Example:** `tests/test_ops.c` has a complete one.
