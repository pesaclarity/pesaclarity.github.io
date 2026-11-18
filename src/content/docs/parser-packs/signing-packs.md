---
title: "Signing packs"
description: "Phones accept a downloaded pack only if its Ed25519 signature verifies against a key built into the app. The signature is detached: base64 of the signature over the exact bytes of pack.yaml, written to pack.yaml.sig."
section: "parser-packs"
order: 8
repo: "ujumbe-parsers"
path: "README.md"
commit: "fcee5edcab37dd6c2c9a2a0d2f76231d0f57a263"
source: "https://github.com/pesaclarity/ujumbe-parsers/blob/fcee5edcab37dd6c2c9a2a0d2f76231d0f57a263/README.md"
edit: "https://github.com/pesaclarity/ujumbe-parsers/edit/main/README.md"
---
Phones accept a downloaded pack only if its Ed25519 signature verifies against a key built into the app. The signature is detached: base64 of the signature over the exact bytes of `pack.yaml`, written to `pack.yaml.sig`.

```sh
dart run tool/sign_pack.dart --generate-key /secure/place/ujumbe.seed
dart run tool/sign_pack.dart --key-file /secure/place/ujumbe.seed packs/mpesa
# or: UJUMBE_SIGNING_KEY=<base64 seed> dart run tool/sign_pack.dart packs/mpesa
```

The tool refuses to sign a pack whose fixtures fail. Private keys stay outside the repo, in a hardware key or secrets manager; tests generate throwaway keys.

Releases are signed by a GitHub Actions workflow: pushing a `v*` tag runs `tool/build_release.dart` to sign each pack and write a signed `index.json` listing them, then uploads them to the GitHub release for phones to download. A pack that needs a newer engine sets `min_engine: x.y.z` in `pack.yaml`, and older apps skip it. See [docs/RELEASING.md](/docs/parser-packs/signing-and-releases/) for the steps, key custody, rotation and where the app pins its keys.
