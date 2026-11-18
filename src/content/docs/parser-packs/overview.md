---
title: "Overview"
description: "SMS parser packs and the pure Dart engine that reads them (and M-Pesa statements), for Pesa Clarity."
section: "parser-packs"
order: 5
repo: "ujumbe-parsers"
path: "README.md"
commit: "fcee5edcab37dd6c2c9a2a0d2f76231d0f57a263"
source: "https://github.com/pesaclarity/ujumbe-parsers/blob/fcee5edcab37dd6c2c9a2a0d2f76231d0f57a263/README.md"
edit: "https://github.com/pesaclarity/ujumbe-parsers/edit/main/README.md"
---
SMS parser packs and the pure Dart engine that reads them (and M-Pesa statements), for [Pesa Clarity](https://github.com/pesaclarity/docs). Each institution (M-Pesa, Airtel Money, Co-operative Bank, Equity, I&M, KCB, Loop, Standard Chartered and, with your help, many more) gets a YAML pack of regex rules with synthetic sample messages. The engine reads only the senders a user has selected, turns each message into a typed transaction with amounts in integer cents, keeps a hash instead of the raw text, and sends anything it cannot read to the user's review inbox. It has no Flutter dependency, so it runs in phone isolates and with plain Dart on any machine.

**Codename:** ujumbe, Swahili for "message".

**Status:** pre-alpha. The pack format may still change before 1.0.

The product spec and brand live in [pesaclarity/docs](https://github.com/pesaclarity/docs); see "SMS parser engine" and "Rules that keep the numbers honest".

## Quick start

Needs the Dart SDK 3.8 or newer.

```sh
dart pub get
dart run tool/check_packs.dart   # validate every pack and run its fixtures
dart test
```

Depending on it from the app (pin a release tag):

```yaml
dependencies:
  ujumbe:
    git:
      url: https://github.com/pesaclarity/ujumbe-parsers
      ref: v0.1.0
```

Using the engine:

```dart
import 'package:ujumbe/ujumbe.dart';

final mpesa = loadBundledPack('mpesa'); // or ParserPack.fromYaml(yaml)
final parser = SmsParser([mpesa]); // only the accounts the user ticked

switch (parser.parse(SmsMessage(sender: from, body: text, receivedAt: at))) {
  case ParsedTransaction t:
    // Store t's fields, t.rawHash and t.dedupeKey; discard the raw text.
  case Unmatched u:
    // Known sender, no rule matched: hold for the review inbox.
  case Ignored():
    // Not a selected sender: drop it, never store it.
}
```

Statements backfill history and check balances. The app extracts each page's words with their positions from the PDF (and handles its password); the engine picks the layout and reads it:

```dart
final pack = detectStatementPack(pages, loadBundledStatementPacks());
final statement = StatementReader(pack!).read(pages);
statement.transactions;        // same dedupeKey as the matching SMS
statement.openingBalanceMinor; // and closingBalanceMinor, periodStart, periodEnd
if (!statement.reconciles) {
  // statement.balanceBreaks and statement.unreadLines show the gap.
}
```

Over-the-air pack updates are checked before use; only correctly signed, compatible packs newer than the installed ones come back:

```dart
final updates = PackUpdateVerifier(pinnedPublicKeys);
final result = await updates.verify(
  indexBytes: indexJson,          // index.json from the release
  indexSignature: indexSig,       // index.json.sig
  packs: {'mpesa': PackDownload(packBytes, packSig)},
);
for (final update in result.accepted) {
  // Store update.packBytes and update.signature; use update.pack.
}
for (final rejection in result.rejected) {
  // rejection.reason: hashMismatch, signatureInvalid, notNewer, ...
}
```

A stored pack is verified again on load with `PackVerifier([...]).loadVerified(bytes, signature)`.

## Project layout

```
lib/
  ujumbe.dart            public API
  src/bundled_packs.dart load the packs shipped with the package
  src/bundled_packs.g.dart generated from packs/; do not edit
  src/pack.dart          pack model and validation
  src/parser.dart        sender filter, parsing, dedupe key, raw-text hash
  src/statements/        statement packs: positioned page text, table layout,
                         pack format, reader, fixtures and the typesetter
  src/fixtures.dart      runs a pack's samples; a pack is valid only if all pass
  src/signing.dart       Ed25519 pack signing and verification
  src/pack_updates.dart  signed pack index and over-the-air update checks
  src/version.dart       engine version and semantic version comparison
  src/money.dart         amounts to integer minor units
  src/time_format.dart   locale-free date patterns for message times
packs/<institution>/
  pack.yaml              the rules
  fixtures.yaml          synthetic samples and expected fields
  statement.yaml         optional: how to read the institution's statement PDF
  statement_fixtures.yaml synthetic statements and what they must read as
schema/                  JSON Schema for the pack, fixture and statement files and the release index.json
tool/
  check_packs.dart       validate packs and run all fixtures
  bundle_packs.dart      regenerate lib/src/bundled_packs.g.dart (--check in tool/check)
  message_examples.dart  regenerate docs/MESSAGES.md (--check in tool/check)
  sign_pack.dart         sign a pack (and generate a signing key)
  build_release.dart     build and sign a release: packs, index.json and signatures
docs/MESSAGES.md         every sample message, by pack (generated)
docs/RELEASING.md        release steps, key custody and rotation
test/                    engine unit tests and a test over every pack
  support/               synthetic statement generators (text and positioned pages)
```

## Testing

```sh
tool/setup-hooks     # once: run the checks before every push
tool/check --fast    # format, analyse, generated files, pack fixtures
tool/check           # all of that, plus dart test and the JSON Schema checks
```

Checks run on your machine, not on GitHub; see [CONTRIBUTING.md](/docs/parser-packs/contributing/#checks-run-on-your-machine).

## Licence

Apache-2.0, see [LICENSE](https://github.com/pesaclarity/ujumbe-parsers/blob/fcee5edcab37dd6c2c9a2a0d2f76231d0f57a263/LICENSE). Packs and fixtures are under the same licence so banks, fintechs and other projects can use them freely. The Pesa Clarity name and logo are trademarks and are not covered by this licence.
