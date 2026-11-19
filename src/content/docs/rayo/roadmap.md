---
title: "Roadmap"
description: "What is planned after v0.1.0. Nothing here is promised by a date; issues and pull requests are welcome."
section: "rayo"
order: 25
repo: "rayo"
path: "docs/ROADMAP.md"
commit: "a1eb966e976eba144c1098dd352a81de02812449"
source: "https://github.com/pesaclarity/rayo/blob/a1eb966e976eba144c1098dd352a81de02812449/docs/ROADMAP.md"
edit: "https://github.com/pesaclarity/rayo/edit/main/docs/ROADMAP.md"
---
What is planned after v0.1.0. Nothing here is promised by a date; issues and pull requests
are welcome.

## Native mobile packages

v0.1.0 ships rayo as C source and as `package:rayo` for Dart and Flutter. Apps written in
Kotlin, Java or Swift build `src/` themselves today ([Licensing](/docs/rayo/licensing/#embedding-rayo-platform-by-platform)
has the steps). Planned:

- **An Android AAR**, with the library for arm64-v8a, armeabi-v7a and x86_64 and a small
  Kotlin API over JNI (models, sessions, the generator), published with each release.
- **An iOS and macOS xcframework**, with a Swift package around it. CI already builds the
  library for the device and the simulator and joins them into an xcframework as a compile
  check (`tool/ci/ios.sh`); what remains is the Swift API, its tests and the release step.

Both will be built from the same sources, with the same flags, so they give the same floats
as every other build.

## Next

- **Phone benchmarks:** the first measured phones, starting with a 2 GB Android Go phone
  (`tool/bench_phone.sh`), in the README's table.
- **Quality on real language models:** agreement of q4 and q3 with float32 on real weights,
  to say when `--q3` is safe to ship.
- **Windows for Dart and Flutter:** the build hook's flags for MSVC, and Windows in the Dart
  CI job (the C library is already built and tested on Windows).
- **Process memory on Windows** (`rayo_process_memory`), which reports nothing there yet.
- **More ops** as models need them.

## Not planned

A GPU or NPU path, C++ or other dependencies, and anything that would need a library
downloaded or prebuilt.
