---
title: "Licensing and embedding"
description: "rayo is free software under the GNU Affero General Public License v3.0 only, with an additional permission, the rayo Linking Exception, that lets apps embed it under any licence."
section: "rayo"
order: 22
repo: "rayo"
path: "docs/LICENSING.md"
commit: "1e536df33c3d0a50b180b7431be52ed9838ebff2"
source: "https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/docs/LICENSING.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/LICENSING.md"
---
rayo is free software under the **GNU Affero General Public License v3.0 only**, with an
additional permission, the **rayo Linking Exception**, that lets apps embed it under any
licence. This page explains what that means for an app, platform by platform.

> [!WARNING]
> The linking exception ([`LICENSE-EXCEPTION`](https://github.com/pesaclarity/rayo/blob/1e536df33c3d0a50b180b7431be52ed9838ebff2/LICENSE-EXCEPTION)) is a **draft**, written
> for the copyright holders to have reviewed by a lawyer before v0.1.0 is tagged. Until that
> review is done and the draft notice is removed, read it as a statement of intent. This page
> is an explanation, not legal advice.

## In one paragraph

You may link or embed an **unmodified** rayo, or one you extend **only through its public
API** (its headers and `package:rayo`, with compile-time options and ops of your own), into an
app, and distribute the app under **any licence**, closed source included. You must say the
app uses rayo, include rayo's licence notices, and let people get rayo's source (a link to the
release you used is enough). If you change rayo's own source, those changes stay under the
AGPL-3.0.

## The licence expression

```
AGPL-3.0-only WITH AdditionRef-rayo-linking-exception-1.0
```

That is the SPDX expression for rayo's runtime: the files under `include/`, `src/`, `lib/` and
`hook/`, and the libraries and Dart package built from them. `AdditionRef-` is SPDX 3.0's
prefix for an exception that is not on the SPDX list; the text is `LICENSE-EXCEPTION`. Tools
that only read SPDX 2.x expressions can record it as
`LicenseRef-rayo-AGPL-3.0-only-with-linking-exception`.

The rest of the repository is `AGPL-3.0-only` without the exception: rayo-convert
(`convert/`), the tests, the tools and the examples. They are tools you run, not code an app
links. Two small files of the runtime are under their own permissive terms, kept with them:
fdlibm's `erf` (`LICENSES/fdlibm.txt`) and c25519's Ed25519 (public domain,
`LICENSES/c25519.txt`).

## What the exception allows, and asks

**Allowed**, under the licence of your choice for your app:

- linking rayo statically or dynamically, from C, C++, Swift, Kotlin (JNI) or any language
  with a C FFI, or through `package:rayo` in Dart and Flutter;
- building it with any compiler, flags and build system, for any target;
- setting the compile-time options of `include/rayo/config.h` and the documented build macros
  (`RAYO_NO_PLATFORM`, `RAYO_NO_THREADS`, `RAYO_AVX2_DECODE`);
- ops of your own, given through `include/rayo/op.h`;
- shipping the result through an app store, with the store's terms and DRM.

**Asked**, for the copy of rayo in your app:

1. **Notices:** say the app uses rayo and which version, and give rayo's copyright notice,
   the AGPL-3.0 (or a link to it), the exception (or a link to it) and the notices in
   `LICENSES/`. An "open-source licences" screen or a file next to the program does it.
2. **Source:** anyone who gets the app can get rayo's source. For an unmodified release, a
   link to it (such as `https://github.com/pesaclarity/rayo/tree/v0.1.0`) and the
   compile-time options you set is enough. Your app's own source is not asked for.

**Not covered:** a rayo whose source you changed. That changed rayo is AGPL-3.0, and so is a
program that includes it, as a whole. To keep your app's licence, send the change upstream
as a pull request: once it is in a release, that release is covered.

## Embedding rayo, platform by platform

### Flutter and Dart

Add `package:rayo` ([Getting started](/docs/rayo/getting-started/#dart-and-flutter)). Its build hook
compiles rayo from source into the app for each target, unmodified, so the exception
applies as long as you do not patch the package. For the notices: Flutter's
`showLicensePage` already lists every package's `LICENSE` file, so rayo's AGPL-3.0 is there;
the exception is a separate file, so copy `LICENSE-EXCEPTION` into the app's assets and add
it:

```dart
LicenseRegistry.addLicense(() async* {
  final text = await rootBundle.loadString('assets/rayo-LICENSE-EXCEPTION.txt');
  yield LicenseEntryWithLineBreaks(['rayo'], text);
});
```

pub.dev shows the package's licence as AGPL-3.0, read from `LICENSE`; the exception ships in
the package next to it.

### Android (Kotlin or Java, through the NDK)

Build `src/` into your app's native library with CMake or ndk-build (every `.c` file of
`src/`, `-Iinclude -Isrc`, `-std=c89 -ffp-contract=off`, and `-mfpu=neon` for armeabi-v7a),
and call it through JNI. A prebuilt AAR is on the [roadmap](/docs/rayo/roadmap/). Put the notices in
the app's "licences" screen, and the source link next to them.

### iOS and macOS (Swift or Objective-C)

Add `src/` and `include/` to an Xcode target (or build a static library or xcframework with
`xcrun clang`, as CI's `tool/ci/ios.sh` does), import `rayo/rayo.h` in a bridging header, and
call it from Swift. App Store distribution is fine under the exception: its terms are allowed
for the combined app, as long as they do not limit rayo's own AGPL-3.0 rights. A prebuilt
xcframework is on the [roadmap](/docs/rayo/roadmap/).

### Desktop and servers (Linux, macOS, Windows)

Compile `src/` with your program or into a library (`make librayo.a`, or your own build).
Ship the notices with the program (an `about` screen, a `LICENSES` folder, or `--licenses`).
Network use: section 13 of the AGPL-3.0 (offering source to users over a network) applies to
rayo itself, and the exception's source condition meets it; it does not reach your program's
own code.

## FAQ

**Can I use rayo in a closed-source, commercial app?** Yes, with rayo unmodified or extended
only through its API, under the conditions above: notices and a link to rayo's source.

**Do I have to publish my app's source, or my model?** No. The exception covers your app's own
parts; your model files are your data, not a part of rayo.

**Are the models rayo-convert writes covered by the AGPL?** rayo-convert is a tool under the
AGPL-3.0, and its output is your model in another format: the copyright holders do not
consider the files it writes to be covered by rayo's licence. A model's own licence (such as
Apache-2.0 for SmolLM2) still applies to it.

**I fixed a bug in rayo. Can I ship the fix?** Yes, under the AGPL-3.0 for the changed rayo.
To keep your app under its own licence, send the fix upstream; once released, use the
release.

**I wrote my own op. Is that a modification?** No. Ops given through `include/rayo/op.h` and
`rayo_model_options.ops` use the public API; they are your code, under your licence.

**Can I change `include/rayo/config.h`'s limits?** Yes, by defining them when you build
(`-DRAYO_MAX_ARENA_BYTES=...`), as the header documents. That is a permitted configuration,
not a modification.

**What about the prebuilt model in the releases?** `smollm2-135m-instruct-q4.weights` is
Hugging Face's SmolLM2-135M-Instruct, under the Apache License 2.0, converted by rayo-convert.
Its licence and notice are next to it in the release; follow those if you ship it.

**Is the exception final?** Not yet: it is a draft awaiting legal review before v0.1.0 is
tagged. The intent above will not change; the wording may.
