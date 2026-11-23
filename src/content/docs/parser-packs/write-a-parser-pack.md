---
title: "Write a parser pack"
description: "New banks, SACCOs and wallets are the main way to contribute. Every pack is gated by its own samples."
section: "parser-packs"
order: 6
repo: "ujumbe-parsers"
path: "README.md"
commit: "07ad926149776c1918720dd8fb6a2ea599c8c592"
source: "https://github.com/pesaclarity/ujumbe-parsers/blob/07ad926149776c1918720dd8fb6a2ea599c8c592/README.md"
edit: "https://github.com/pesaclarity/ujumbe-parsers/edit/main/README.md"
---
New banks, SACCOs and wallets are the main way to contribute. Every pack is gated by its own samples.

1. **Create the directory.** `packs/<id>/` where `<id>` is lower case with underscores, e.g. `co_op_bank` or `airtel_money`. The pack's `id` must match.
2. **Write `pack.yaml`.** Copy `packs/kcb/pack.yaml` as a start. Set `senders` to the exact sender IDs the institution uses, `currency` (for messages that print none), `utc_offset` and a `time_format`. If no real wording is known yet, `rules: []` makes a review-only pack: its senders are read and every message goes to the review inbox. Otherwise add one rule per message type (`sent`, `received`, `paybill`, `till`, `withdrawal`, `airtime`, `fuliza`, `fuliza_repayment`, `loan_repayment`, `reversal`, or `bank` for plain debit and credit alerts). Each rule's `pattern` is a regex using these named groups only:

   | Group | Meaning |
   | --- | --- |
   | `amount` | Required. Digits with optional commas and decimals; becomes integer cents |
   | `receipt` | The institution's reference |
   | `direction` | Captured word such as "debited", mapped by `direction_values` (otherwise set a fixed `direction: in` or `out`) |
   | `counterparty` | The other party as printed |
   | `account` | The other side's phone, account or paybill reference, as printed (usually masked) |
   | `own_account` | The account holder's own account number, as printed (`0170*****4321`); tells two accounts at the same bank apart |
   | `currency` | The currency printed with the amount (`USD`, `EUR`; `Ksh` and `Kshs` read as KES). Without it, amounts are in the pack's `currency` |
   | `balance`, `fee` | Money after the transaction, and its cost |
   | `time` | Date and time as printed, read with `time_format` |
   | `owed` | A debt's total still owed after this message, such as Fuliza's outstanding amount |
   | `due` | When that debt is due, a date read with the rule's `due_format` |

   Rules are tried in order and the first match wins, so put specific shapes before general ones. When a message describes money moving on another institution's account, such as a bank's confirmation of an M-Pesa payment into it, set `institution` on the rule to that institution's pack id (`institution: mpesa`); the app then records it on that account, and the bank's own alert records the other side. Set `ignore_case: true` on a rule when the institution's wording changes case (`M-PESA` and `M-Pesa`). Sender IDs always compare without case, so `AirtelMoney` matches `airtelmoney`. If a message prints no time, the engine uses the time the phone received it. Then set `min_engine` if the pack uses a newer feature (see Engine versions below).

   **Notices.** Some messages from a selected sender are known not to be transactions: a declined card payment, a balance enquiry printed like a card transaction of KES 0. Rather than leave them in the review inbox, list them under `notices`, each with an `id` and a `pattern` (and `ignore_case` if needed):

   ```yaml
   notices:
     - id: declined_card_payment
       pattern: '^[A-Z]{3} ?[\d,]+\.\d{2} transaction made on KCB card [\d*]+ at .+? has been declined\.'
   ```

   Notices are tried only after every rule has failed to match, so a notice never hides a transaction. A match parses as a `KnownNotice` naming the notice's `id`, and the app drops it without storing it or asking the person. A notice reads no fields, so its pattern has no named groups. Anchor it with `^` and keep it narrow: unlike an unmatched message, a notice is never reviewed. Only add one for a shape known from real messages (as a synthetic sample), never for a guessed format.

   **Engine versions.** `min_engine` (a [SemVer 2.0](https://semver.org) version, default `0.1.0`) names the oldest engine that can read the pack. An older engine refuses the whole pack with a `PackEngineException` (over the air: a `PackRejection` with reason `engineTooOld`), so the phone keeps its current copy instead of reading the pack half-way. Pre-releases count as older than their release: `0.4.0-beta.1` does not meet `min_engine: 0.4.0`. The engine also refuses a pack whose `min_engine` is lower than a feature it uses needs, so set at least:

   | Feature | `min_engine` |
   | --- | --- |
   | `own_account` or `currency` group, or `rules: []` (review-only) | `0.2.0` |
   | `owed` or `due` group, or `due_format` | `0.3.0` |
   | `min_engine` on a rule | `0.3.1` (the first release after 0.3.0) |
   | `loan_repayment` type, `institution` on a rule, or `notices` | `0.4.0` |

   To add a rule for a newer engine without cutting older phones off the rest of the pack, give that rule its own `min_engine`. An older engine skips just that rule, lists it in `ParserPack.skippedRules`, and sends its messages to the review inbox; it reads the rest of the pack as usual.

3. **Write `fixtures.yaml`.** At least one sample per rule and per notice, plus samples that must stay `unmatched` (promotions, service notices, balance enquiries). Every field the rule captures must appear in `expect`; a field left out must parse as absent. A sample a notice must drop has `expect: {notice: <id>}`, with no other fields.
4. **Check it.** `dart run tool/check_packs.dart packs/<id>`, then `dart run tool/bundle_packs.dart` to ship it with the package, `dart run tool/message_examples.dart` to list its samples in [docs/MESSAGES.md](/docs/parser-packs/example-messages/), then `dart test`. Your editor can also validate against `schema/` through the `yaml-language-server` comment at the top of each file.
5. **Open a pull request** naming the institution and which message types you covered.

Bump a pack's `version` whenever its rules change. Maintainers sign released packs; contributors never need a key.

## Adding a statement layout

Statement PDFs are read from each word's position on the page, so columns and wrapped descriptions survive. The app extracts the words; a statement pack says how to read them. The full design is in the [statement import spec](https://github.com/pesaclarity/docs/blob/main/spec/statement-import.md).

1. **Write `packs/<id>/statement.yaml`.** Copy `packs/mpesa/statement.yaml`. Set `institution` to the SMS pack's id, `detect` patterns that match the first page, the `period`, and one entry under `columns` per table column, left to right, each with a `header` pattern. Amounts and balances are `align: right`. Use `money_in` and `money_out`, or one `amount` column with `amount: { negative_is: out }` or a `marker` column with `marker_out` and `marker_in` (`DR` and `CR`). `row_starts_with` names the column that is filled only on a row's first line, usually the date. Add `skip` patterns for page chrome, `fees` if charges are separate rows, and description `rules` to set the transaction type, `counterparty` and `account`.
2. **Write `statement_fixtures.yaml`.** Typeset synthetic pages: `columns` gives each column's left edge (or `">"` and its right edge for amounts), and each line is free text or a list of cells. Cover every rule, a row wrapping across a page break, and the expected balances.
3. **Check it** with `dart run tool/check_packs.dart packs/<id>` and `dart run tool/bundle_packs.dart`.

Never build fixtures from a real statement by copying its text. Write the rows by hand in the same shape, as for SMS samples.

## The synthetic-data rule

Never commit a real message, statement, name, phone number, account number or receipt. Rewrite a real message by hand into a synthetic one with the same shape: names like `JANE DOE` or `EXAMPLE GROCERS`, numbers like `0700***001` or `****0001`, receipts like `TJA0000001`, and round made-up amounts. A pull request that contains real data will be closed and its history purged, so please check before you push.
