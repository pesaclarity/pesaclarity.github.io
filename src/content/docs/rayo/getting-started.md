---
title: "Getting started"
description: "rayo runs a model file on the CPU, on the device, with nothing downloaded at run time."
section: "rayo"
order: 12
repo: "rayo"
path: "docs/GETTING-STARTED.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/GETTING-STARTED.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/GETTING-STARTED.md"
---
rayo runs a model file on the CPU, on the device, with nothing downloaded at run time. This
page takes you from nothing to a first run three ways: from C, from Dart or Flutter, and
converting a model of your own with rayo-convert (Python). Each takes a few minutes.

You need a C compiler for any of them (gcc, clang, the Android NDK, Xcode or MSVC); rayo has no
other dependency. The model used below, `examples/classifier/classifier.weights`, is a 3 KB
classifier in the repository: three token ids in, three labels' probabilities out.

```sh
git clone https://github.com/pesaclarity/rayo.git
cd rayo
```

> [!NOTE]
> The examples need rayo v0.1.0 or later. Until the `v0.1.0` tag is published, use the
> `main` branch.

## At a glance

The same run in each language: map the model, make a session, bind the sequence length `T`,
write the three ids in place, run, read the probabilities in place. The sections below build
and run each one.

<!-- tabs: C | Dart | Python -->

```c
/* The core of examples/c/quickstart.c (which checks every status). */
static const rayo_i32 ids[3] = {4, 17, 9};
rayo_model_load("examples/classifier/classifier.weights", NULL, &model, &msg);
rayo_session_create(model, &session, &msg);
rayo_session_bind(session, "T", 3, &msg);
rayo_session_input(session, 0, &in);    /* int32 [3] */
memcpy(in.data, ids, sizeof ids);
rayo_session_run(session, &msg);
rayo_session_output(session, 0, &out);  /* float32 [3]: 0.275287 0.227712 0.497001 */
rayo_session_destroy(session);
rayo_model_destroy(model);
```

```dart
final model = RayoModel.map('examples/classifier/classifier.weights');
final session = RayoSession(model)..bind('T', 3);
session.inputInt32(0).setAll(0, [4, 17, 9]);
session.run();
print(session.outputFloat32(0)); // [0.2752..., 0.2277..., 0.4970...]
session.close();
model.close();
```

```python
# rayo-convert's checker runs rayo's C library from Python (ctypes, Linux and macOS).
from rayo_convert.runtime import Library, Model, Session

lib = Library.build(".")  # compiles rayo's src/ once, with the system's C compiler
model = Model(lib, path="examples/classifier/classifier.weights")
session = Session(model)
session.bind("T", 3)
session.run([[4, 17, 9]])  # writes the input in place, then runs
print(session.output(0))  # [0.27528727 0.22771175 0.49700096]
session.close()
model.close()
```

## C

The whole C API a program needs is five calls: load a model, make a session, set the
input, run, read the output. This is [`examples/c/quickstart.c`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/c/quickstart.c),
built and checked against NumPy in CI:

```c
#include <stdio.h>

#include "rayo/rayo.h"

int main(int argc, char **argv) {
  static const rayo_i32 ids[3] = {4, 17, 9};
  rayo_model *model = NULL;
  rayo_session *session = NULL;
  rayo_tensor_view in, out;
  rayo_message msg;
  size_t i;
  int status = 1;
  if (argc != 2) return 2;
  if (rayo_model_load(argv[1], NULL, &model, &msg) != RAYO_OK ||
      rayo_session_create(model, &session, &msg) != RAYO_OK ||
      rayo_session_bind(session, "T", 3, &msg) != RAYO_OK) {
    fprintf(stderr, "rayo: %s\n", msg.text);
    goto done;
  }
  rayo_session_input(session, 0, &in); /* int32 [T]: written in place */
  for (i = 0; i < 3; i++) ((rayo_i32 *)in.data)[i] = ids[i];
  if (rayo_session_run(session, &msg) != RAYO_OK) {
    fprintf(stderr, "rayo: %s\n", msg.text);
    goto done;
  }
  rayo_session_output(session, 0, &out); /* float32 [3]: read in place */
  for (i = 0; i < out.bytes / sizeof(rayo_f32); i++) printf("%.6f\n", ((rayo_f32 *)out.data)[i]);
  status = 0;
done:
  rayo_session_destroy(session); /* before the model; NULL is fine */
  rayo_model_destroy(model);
  return status;
}
```

Build it and run it:

```sh
make quickstart
./examples/c/quickstart examples/classifier/classifier.weights
# 0.275287
# 0.227712
# 0.497001
```

`make quickstart` compiles every file of `src/` with the program: rayo is meant to be built
into your program from source, by your own build, with no library to install. Any build
system works; the rules are short:

- **Sources:** every `.c` file under `src/`, with `-Iinclude -Isrc`.
- **Flags:** `-std=c89` (or any later C), and **`-ffp-contract=off`** with gcc and clang, so
  your build gives the same floats as every other ([Concepts](/docs/rayo/concepts/#the-same-floats-everywhere)).
  MSVC needs nothing: it does not contract by default.
- **Libraries:** `-lm`, and `-lpthread` on Linux and older Android. Windows and macOS need
  none.
- **Optional:** `-DRAYO_NO_PLATFORM` for a plain C89 build with no system headers at all
  (files read with `fread`, one thread).

```sh
# The same, by hand, with any C compiler:
cc -std=c89 -O2 -ffp-contract=off -Iinclude -Isrc $(find src -name '*.c') \
  examples/c/quickstart.c -lm -lpthread -o quickstart
```

Next: [Concepts](/docs/rayo/concepts/) for what a model, a session and a size symbol are, and the
[C API reference](/docs/rayo/c-api/) for every function.

## Dart and Flutter

`package:rayo` wraps the same C code with `dart:ffi`. Its build hook compiles `src/` for
whatever the app targets (the NDK for Android, Xcode for iOS and macOS, clang or gcc on
Linux) while the app builds: no prebuilt library, nothing downloaded, so an F-Droid build is
reproducible offline. It needs Dart 3.10 or Flutter 3.38 or later.

Add it to `pubspec.yaml`, from pub.dev or from git at the release tag:

<!-- tabs: pub.dev | Git -->

```yaml
dependencies:
  rayo: ^0.1.0
```

```yaml
dependencies:
  rayo:
    git:
      url: https://github.com/pesaclarity/rayo.git
      ref: v0.1.0
```

The same classifier as above, from Dart:

```dart
import 'package:rayo/rayo.dart';

void main() {
  final model = RayoModel.map('examples/classifier/classifier.weights');
  final session = RayoSession(model); // keep it for many runs
  try {
    session.bind('T', 3);
    session.inputInt32(0).setAll(0, [4, 17, 9]); // written in place
    session.run();
    print(session.outputFloat32(0)); // [0.2752..., 0.2277..., 0.4970...]
  } finally {
    session.close(); // before the model
    model.close();
  }
}
```

```sh
dart run example/example.dart examples/classifier/classifier.weights 4 17 9
```

In a Flutter app, run models off the UI isolate: `runInIsolate(session, task)` for a session,
or `Isolate.run` around a whole generation, as
[`examples/flutter_chat`](https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/examples/flutter_chat) does:

```dart
final reply = await Isolate.run(() {
  final model = RayoModel.map(path); // a language model converted by rayo-convert
  final tokenizer = RayoTokenizer.fromModel(model);
  final generator = RayoGenerator(model, tokenizer, temperature: 0, maxTokens: 128);
  try {
    generator.chat('What is a budget?');
    return generator.reply().join();
  } finally {
    generator.close();
    tokenizer.close();
    model.close();
  }
});
```

> [!TIP]
> `rayoAvailable()` tells you whether the native library loaded, so an app can hide a
> feature instead of failing on a platform the hook does not build for.

Next: the [Dart API reference](/docs/rayo/dart-api/), and [Running small language
models](/docs/rayo/small-language-models/) for chat.

## Convert a model (Python)

rayo runs its own file format, a plain-weights file with the graph in its header
([FORMAT.md](/docs/rayo/format/)). `rayo-convert` writes one from a TFLite or ONNX model, or from a
Hugging Face language model (`config.json`, `*.safetensors`, `tokenizer.json`). It is
Python 3.10+ and NumPy; never TensorFlow or torch.

<!-- tabs: Install | As a library -->

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install "./convert[tflite]"      # TFLite models
pip install "./convert[onnx]"        # ONNX models
pip install "./convert[chat]"        # language models, with their chat template
```

```python
# rayo-convert is also a library: the same conversion from Python.
from pathlib import Path

from rayo_convert import hf

hf.convert_dir(Path("models/src"), Path("models/smollm2.weights"),
               hf.HfOptions(name="smollm2", weights="q4", context=2048))
```

Then convert:

```sh
rayo-convert my_model.tflite -o my_model.weights          # a TFLite model
rayo-convert my_model.onnx -o my_model.weights            # an ONNX model
rayo-convert models/src -o models/smollm2.weights --weights q4 --context 2048   # an LLM
```

It prints what it decided (fusions, the size symbols it made, the rewrite for decoding), and
refuses what rayo cannot run, naming each op, its index in the source and why. Run the result
with the C or Dart code above: bind its symbols, write its inputs, read its outputs. The
[converter's guide](/docs/rayo/converting/) has every option, and [Running small language
models](/docs/rayo/small-language-models/) goes from a Hugging Face model to a chat on a phone.

> [!TIP]
> Each rayo release attaches a ready-converted language model,
> `smollm2-135m-instruct-q4.weights` (SmolLM2-135M-Instruct, Apache-2.0, about 80 MB), with
> its SHA-256 and licence, so you can try chat without converting anything.

## Where next

| | |
| --- | --- |
| [Concepts](/docs/rayo/concepts/) | models, sessions, size symbols, states, the weights format, quantisation, threads, memory |
| [C API](/docs/rayo/c-api/) / [Dart API](/docs/rayo/dart-api/) | every function and class, with its signature |
| [Performance](/docs/rayo/performance/) | the benchmarks, the hardware they came from, and measuring a phone |
| [Security](/docs/rayo/security/) | what rayo guarantees for untrusted models and text; signed models |
| [Licensing](/docs/rayo/licensing/) | AGPL-3.0 with the linking exception: what it means for your app |
| [Troubleshooting](/docs/rayo/troubleshooting/) / [FAQ](/docs/rayo/faq/) | errors and what they mean |
