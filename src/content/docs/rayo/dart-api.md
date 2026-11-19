---
title: "Dart API reference"
description: "package:rayo is rayo for Dart and Flutter: the C library through dart:ffi, compiled from source by the package's build hook for whatever the app targets. One import gives all of it:"
section: "rayo"
order: 15
repo: "rayo"
path: "docs/API-DART.md"
commit: "1e536df33c3d0a50b180b7431be52ed9838ebff2"
source: "https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/docs/API-DART.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/API-DART.md"
---
`package:rayo` is rayo for Dart and Flutter: the C library through `dart:ffi`, compiled from
source by the package's build hook for whatever the app targets. One import gives all of it:

```dart
import 'package:rayo/rayo.dart';
```

The rules that hold for every class, so they are not repeated below:

- Objects that hold native memory have a `close()`. Call it when done (in a `finally`), in
  the reverse order of creation: generator, tokeniser, session, model. `close()` twice is
  fine; any other call after it throws a `StateError`.
- A failed native call throws a [`RayoException`](#rayoexception) with the C status and
  message. Bad arguments raised in Dart throw `ArgumentError` or `RangeError`.
- Inputs and outputs are **views of native memory** (`Int32List`, `Float32List`): no copy in
  or out. An output view is valid until the next run of its session; copy it
  (`List.of(view)`) to keep it.
- A session or generator runs on one isolate at a time. Run models off the UI isolate:
  [`runInIsolate`](#runinisolate) for a session, `Isolate.run` around a whole generation.

[Concepts](/docs/rayo/concepts/) explains models, sessions, size symbols and states; the
[C API](/docs/rayo/c-api/) has the functions these call.

## Contents

| | |
| --- | --- |
| [`RayoModel`](#rayomodel) | a loaded model: weights and graph |
| [`RayoSession`](#rayosession), [`RayoSessionRef`](#rayosessionref), [`runInIsolate`](#runinisolate) | running a model |
| [`RayoTokenizer`](#rayotokenizer), [`RayoGenerator`](#rayogenerator) | text from a language model |
| [`RayoIntegrity`](#rayointegrity), [`rayoVerify`](#rayoverify), [`rayoVerifyFile`](#rayoverifyfile), [`rayoErrIntegrity`](#rayoerrintegrity) | SHA-256 and Ed25519 checks |
| [`RayoTensorInfo`](#rayotensorinfo), [`RayoDtype`](#rayodtype), [`RayoMemory`](#rayomemory), [`RayoProcessMemory`](#rayoprocessmemory) | descriptions |
| [`RayoException`](#rayoexception) | errors |
| [`rayoAvailable`](#rayoavailable), [`rayoVersion`](#rayoversion), [`rayoBuiltinOps`](#rayobuiltinops), [`rayoSha256`](#rayosha256) | the library |

## Models

### `RayoModel`

```dart
class RayoModel
```

A loaded model: weights and graph, shared by its sessions. Close it after them.

#### `RayoModel.map`

```dart
factory RayoModel.map(String path, {RayoIntegrity? integrity})
```

Maps the model file at `path` (mmap): its weights are used where they are, with no copy, and
cost memory only as they are read. **The way to load a language model.** With `integrity`, the
mapped bytes must match it before rayo reads them (for a model downloaded over the air,
require its signature). The file must not change while the model lives.

#### `RayoModel.load`

```dart
factory RayoModel.load(Uint8List bytes, {String? sha256, RayoIntegrity? integrity})
```

Reads a model from `bytes`. With `sha256` (hex), the bytes must hash to it; with `integrity`,
they must match it, checked by the C library on the copy it reads, before it parses anything:
a mismatch throws a `RayoException` of status [`rayoErrIntegrity`](#rayoerrintegrity). rayo
keeps its own copy, so `bytes` may be dropped afterwards. Throws `ArgumentError` when
`sha256` and `integrity.sha256` disagree.

```dart
final bytes = (await rootBundle.load('assets/classifier.weights')).buffer.asUint8List();
final model = RayoModel.load(bytes, sha256: expectedSha256);
```

#### `RayoModel.loadFile`

```dart
factory RayoModel.loadFile(String path, {String? sha256, RayoIntegrity? integrity})
```

Reads the model file at `path` into memory and loads it as [`RayoModel.load`](#rayomodelload).

#### Members of `RayoModel`

| Member | |
| --- | --- |
| `final String name` | the header's `"model"`, such as `example-classifier` |
| `late final Map<String, Object?> metadata` | the header's `"metadata"` object |
| `late final List<RayoTensorInfo> inputs` | the inputs, at their largest sizes |
| `late final List<String> outputs` | the outputs' names |
| `int inputIndex(String name)` | the index of input `name`; throws `RayoException` when there is none |
| `int outputIndex(String name)` | the same for an output |
| `RayoMemory get memory` | what the model holds ([`RayoMemory`](#rayomemory)) |
| `Pointer<RayoModelHandle> get handle` | the native model, for bindings of your own; throws `StateError` once closed |
| `void close()` | frees the model; close its sessions, tokenisers and generators first |

## Sessions

### `RayoSession`

```dart
class RayoSession
```

Runs a model. The session plans all its memory when it is made; inputs and outputs are views
of that memory, written and read in place, so a run copies nothing and allocates nothing.
Keep one session for many runs; it must not run on two threads at once.

```dart
final s = RayoSession(model)..bind('T', ids.length);
s.inputInt32(0).setAll(0, ids);
s.run();
final probabilities = s.outputFloat32(0);
```

#### `RayoSession()`

```dart
factory RayoSession(RayoModel model)
```

A new session on `model`, on one thread; close it before the model. (Threads, the int8
cache and symbol limits are in the C API's `rayo_session_create_with`; for language models,
[`RayoGenerator`](#rayogenerator) sets them.)

#### `RayoSession.borrow`

```dart
factory RayoSession.borrow(RayoSessionRef ref)
```

The session `ref` was made from by [`reference`](#members-of-rayosession), for another isolate of this
process. Closing it frees only this object's buffers, not the session.

#### Members of `RayoSession`

| Member | |
| --- | --- |
| `void bind(String symbol, int value)` | sets size symbol `symbol` (such as `T`) for the next runs; inputs and outputs then have the new sizes |
| `Int32List inputInt32(int index)` | input `index` at the current sizes, to write into; throws `RayoException` when it is not int32 |
| `Float32List inputFloat32(int index)` | the same for a float32 input |
| `void run()` | runs the graph on this thread |
| `Float32List outputFloat32(int index)` | output `index` of the last run: a view, valid until the next run |
| `RayoTensorInfo outputInfo(int index)` | output `index`'s current name, dtype and shape |
| `void reset()` | zeroes the session's states, such as a decoder's key/value cache, to start a new sequence |
| `String get kernels` | the kernels this session runs, such as `neon-dotprod` |
| `RayoMemory get memory` | what the session holds ([`RayoMemory`](#rayomemory)) |
| `RayoSessionRef get reference` | what another isolate needs to [`borrow`](#rayosessionborrow) this session |
| `void close()` | frees the session (a borrowed one: only this object's buffers) |

### `RayoSessionRef`

```dart
class RayoSessionRef {
  const RayoSessionRef(this.session, this.model);
  final int session;
  final int model;
}
```

The addresses of a session and its model, to borrow it in another isolate of the same
process. Sendable through a `SendPort`.

### `runInIsolate`

```dart
Future<R> runInIsolate<R>(RayoSession session, R Function(RayoSession session) task)
```

Runs `task` on `session` in a short-lived isolate, so a UI isolate never waits on a run. Runs
on one session must not overlap: await each before the next (or keep a queue).

```dart
final intent = await runInIsolate(session, (s) {
  s.bind('T', ids.length);
  s.inputInt32(0).setAll(0, ids);
  s.run();
  return List.of(s.outputFloat32(1)); // copy: the view dies with the isolate's run
});
```

## Text

### `RayoTokenizer`

```dart
class RayoTokenizer
```

A model's tokeniser: the table rayo-convert writes into the model file, read in place, or its
`tokenizer.json`. Close it after the generators that use it, and before its model.

#### `RayoTokenizer.fromModel`

```dart
factory RayoTokenizer.fromModel(RayoModel model)
```

The table in `model`'s file, read where it is in the mapped file: no JSON is parsed. Throws
when the file has none (convert it again with rayo-convert).

#### `RayoTokenizer.load`

```dart
factory RayoTokenizer.load(String path)
```

Reads the `tokenizer.json` at `path`.

#### Members of `RayoTokenizer`

| Member | |
| --- | --- |
| `List<int> bytesOf(int id)` | the bytes token `id` stands for (a character may span tokens); empty for an id it does not have |
| `Pointer<RayoTokenizerHandle> get handle` | the native tokeniser |
| `void close()` | frees it |

### `RayoGenerator`

```dart
class RayoGenerator
```

Text from a language model, a token at a time, with the key/value cache kept across turns
(`rayo/generate.h`).

```dart
final model = RayoModel.map('smollm2.weights');
final tokenizer = RayoTokenizer.fromModel(model);
final g = RayoGenerator(model, tokenizer, temperature: 0.7);
g.chat('Hello!');
for (final piece in g.reply()) stdout.write(piece); // break to stop early
g.close();
tokenizer.close();
model.close();
```

Each step is a bounded native call (a prompt chunk, or one token), so a reply is cancelled by
breaking out of [`reply`](#members-of-rayogenerator) or calling `cancel`. Run it in a background isolate
(`Isolate.run`, or a long-lived isolate fed by a port) so the UI never waits; a generator
belongs to the isolate that made it.

#### `RayoGenerator()`

```dart
factory RayoGenerator(
  RayoModel model,
  RayoTokenizer tokenizer, {
  double temperature = 0.7,
  int topK = 40,
  double topP = 0.9,
  double minP = 0.05,
  double repetitionPenalty = 1.1,
  int seed = 1,
  int? threads,
  int maxTokens = 256,
  int? context,
  int? chunk,
  bool int8Cache = true,
})
```

| Parameter | |
| --- | --- |
| `model`, `tokenizer` | a decoder converted by rayo-convert, and its tokeniser; both must outlive the generator |
| `temperature` | `0` decodes greedily (the most likely token) |
| `topK`, `topP`, `minP`, `repetitionPenalty` | the sampler's filters, as `rayo_sampler_options` |
| `seed` | the same seed and inputs give the same tokens |
| `threads` | `null` for the default (`rayo_cpu_default_threads`: a phone's fast cores, at most 2 on Android and 4 elsewhere), else that many |
| `maxTokens` | the most tokens a reply has |
| `context` | the tokens the conversation holds, `null` for 1024 (at most the model's); the key/value cache is sized for it |
| `chunk` | prompt tokens a run, `null` for 32 |
| `int8Cache` | the key/value cache in int8, a quarter of float32's memory |

#### Members of `RayoGenerator`

| Member | |
| --- | --- |
| `void chat(String user, {String? system})` | a user's turn (with an optional `system` text before the first), in the model's own chat template, run through the model |
| `void prompt(String text)` | raw text, run through the model, for the reply to continue |
| `Iterable<String> reply()` | the reply as text, piece by piece as it is made (whole characters only) |
| `int? next()` | the next token id, or `null` when the reply has ended (or was cancelled) |
| `void cancel()` | ends the reply being made: the next step returns nothing |
| `void reset()` | forgets the conversation |
| `bool get canChat` | whether the model has a chat template |
| `int get position` | tokens in the cache |
| `int get context` | the most tokens the cache holds |
| `int get threads` | the threads it runs on |
| `String get kernels` | the kernels it runs |
| `void close()` | frees it |

## Integrity

### `RayoIntegrity`

```dart
RayoIntegrity({String? sha256, Uint8List? publicKey, Uint8List? signature})
```

What a model file must match before rayo reads it ([SECURITY.md](/docs/rayo/security/)): its SHA-256
(lower- or upper-case hex), and or an Ed25519 signature of the whole file (`publicKey`, 32
bytes, and `signature`, 64 bytes: "pure" Ed25519, RFC 8032, as `tool/sign_model.py` or
`openssl pkeyutl -sign -rawin` writes it). Every one given is checked. Throws `ArgumentError`
when none is given, when only one of `publicKey` and `signature` is, or when a size or the hex
is wrong. Its fields are `sha256`, `publicKey` and `signature`; `toC(Arena)` builds the C
struct, for bindings of your own.

```dart
final model = RayoModel.map(path,
    integrity: RayoIntegrity(publicKey: publisherKey, signature: sig));
```

### `rayoVerify`

```dart
void rayoVerify(Uint8List bytes, RayoIntegrity want)
```

Checks `bytes` against `want`; throws a `RayoException` whose status is
[`rayoErrIntegrity`](#rayoerrintegrity) when they do not match. To load the bytes that were
checked, pass `want` to `RayoModel.load` or `RayoModel.map` instead.

### `rayoVerifyFile`

```dart
void rayoVerifyFile(String path, RayoIntegrity want)
```

Checks the file at `path` against `want`, as `rayoVerify`.

### `rayoErrIntegrity`

```dart
const rayoErrIntegrity = 7;
```

The `rayo_status` of a failed integrity check (`RAYO_ERR_INTEGRITY`), to tell it from other
failures: `on RayoException catch (e) { if (e.status == rayoErrIntegrity) ... }`.

## Descriptions

### `RayoTensorInfo`

```dart
class RayoTensorInfo {
  const RayoTensorInfo(this.name, this.dtype, this.shape);
  final String name;
  final RayoDtype dtype;
  final List<int> shape;
  int get count;
}
```

A model input's or output's name, dtype and shape (row-major, outermost first); `count` is the
number of elements. `toString()` gives `name dtype [shape]`, such as `tokens int32 [12]`.

### `RayoDtype`

```dart
enum RayoDtype { float32, int32, int8 }
```

An element type.

### `RayoMemory`

```dart
class RayoMemory {
  const RayoMemory(this.weights, this.arena, this.overhead, this.states);
  final int weights;
  final int arena;
  final int overhead;
  final int states;
  int get total;
}
```

Bytes held by a model or a session: `weights` (the model's copy of the file and packed
weights), `arena` (a session's activations and scratch, planned once), `overhead` (graph,
plans and tables), `states` (of `arena`: a session's states, such as a decoder's key/value
cache, in full); `total` is `weights + arena + overhead`.

### `RayoProcessMemory`

```dart
class RayoProcessMemory {
  static RayoProcessMemory? now();
  final int privateBytes;
  final int fileBytes;
  final int residentBytes;
  final int peakResidentBytes;
}
```

What the whole process holds in memory now, as the system counts it (`rayo_process_memory`):
its own (`privateBytes`: the heap, caches) and the resident pages of mapped files
(`fileBytes`: the weights), which the system can drop under pressure. `now()` is `null` where
the system does not say (Windows, for now).

## Errors

### `RayoException`

```dart
class RayoException implements Exception {
  RayoException(this.status, this.message);
  final int status;
  final String message;
}
```

A rayo call that failed: a damaged model, a size that does not fit, a closed object. `status`
is the C library's `rayo_status` (0 for errors raised in Dart); `message` is the status's
name and the C message, such as `shape error: T = 99, it must be 0 to 32`.

## The library

### `rayoAvailable`

```dart
bool rayoAvailable()
```

Whether the native library loads here (it does on every target the build hook compiles for).
Never throws, so an app can fall back.

### `rayoVersion`

```dart
String rayoVersion()
```

The library's version, such as `0.1.0`.

### `rayoBuiltinOps`

```dart
List<String> rayoBuiltinOps()
```

The ops rayo has built in ([OPS.md](/docs/rayo/ops/)), such as `dense`.

### `rayoSha256`

```dart
String rayoSha256(Uint8List bytes)
```

Lower-case hex SHA-256 of `bytes`, computed natively.
