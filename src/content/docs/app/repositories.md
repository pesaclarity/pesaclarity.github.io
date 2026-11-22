---
title: "The repositories"
description: "The pesaclarity GitHub organisation holds one repository per licence boundary from the spec's open-source section. All exist now; each is built in the phase shown."
section: "app"
order: 0
repo: "docs"
path: "REPOS.md"
commit: "e0e3122b322c215b6a00b032b7b0246785025d2a"
source: "https://github.com/pesaclarity/docs/blob/e0e3122b322c215b6a00b032b7b0246785025d2a/REPOS.md"
edit: "https://github.com/pesaclarity/docs/edit/main/REPOS.md"
---
The `pesaclarity` GitHub organisation holds one repository per licence boundary from the spec's open-source section. All exist now; each is built in the phase shown. Codenames are Swahili words used for package and module names.

| Repo | Codename | What | Licence | Built in |
| --- | --- | --- | --- | --- |
| [`.github`](https://github.com/pesaclarity/.github) | | Org profile, contributing guide, code of conduct, security policy, issue templates | CC BY 4.0 | Phase 0 |
| [`docs`](https://github.com/pesaclarity/docs) | | This repo: spec, brand, decisions | CC BY 4.0 (text), trademarks excluded | Phase 0 |
| [`ujumbe-parsers`](https://github.com/pesaclarity/ujumbe-parsers) | ujumbe (message) | SMS parser packs per institution, Dart engine, synthetic fixtures, pack signing | Apache-2.0 | 1. Parsers and engine (weeks 3–6) |
| [`pesaclarity-app`](https://github.com/pesaclarity/pesaclarity-app) | | Flutter app for Android and iPhone: personal money (plan, goals, debts, FHI, insights), spaces for business, household, savings group, rental and farm, the business side (sales, stock, people, reports, tax estimates, receipts and invoices), Drift + SQLCipher ledger, backups, review inbox. Play Store, F-Droid and App Store flavours | AGPL-3.0 + commercial on request | 1–2 (weeks 3–11) |
| [`pesaclarity.github.io`](https://github.com/pesaclarity/pesaclarity.github.io) | dirisha (window) | Website: what Pesa Clarity is, principles, privacy, open source, calls to action | AGPL-3.0 (code), CC BY 4.0 (text) | 2, before Play review |
| [`pesaclarity-backend`](https://github.com/pesaclarity/pesaclarity-backend) | ngome (fortress) | Auth, encrypted backup vault (Play Integrity and App Attest), federated-learning aggregator. Docker, Cloud Run | AGPL-3.0 + commercial on request | 2–3 (weeks 7–14) |
| [`pesaclarity-ml`](https://github.com/pesaclarity/pesaclarity-ml) | akili (intelligence) | Categoriser, message reader, Ask reader and writer, DP-SGD config, rayo weights export, MLflow tracking, release audits | AGPL-3.0 (code); app-track weights CC BY-SA 4.0, commercial-track weights by written licence | 3. Beta (weeks 12–14) |
| [`rayo`](https://github.com/pesaclarity/rayo) | | On-device inference engine in pure C89, with no Google libraries: runs the app's models and small language models on phones, a converter from TFLite, ONNX and Hugging Face files, and a Dart package | AGPL-3.0 | After phase 3 ([0020](https://github.com/pesaclarity/docs/blob/e0e3122b322c215b6a00b032b7b0246785025d2a/decisions/0020-rayo-our-own-inference-engine.md)) |

`pesaclarity-app` depends on `ujumbe-parsers` as the Dart package `ujumbe`, so packs version and release independently of the app.

## Rules for every repo

- Synthetic or fully anonymised test data only. Never commit real SMS, statements or phone numbers.
- No secrets in any repo. App signing, pack signing and server keys live in a hardware key or secrets manager.
- `main` is protected: pull requests, no force-push.
- Checks run on your machine, not on GitHub. Every code repo (`pesaclarity-app`, `ujumbe-parsers`, `pesaclarity-backend`, `pesaclarity-ml` and the website) has `tool/check`, and `tool/setup-hooks` turns on a pre-push hook that runs it before every push. GitHub Actions only builds, releases and deploys; pull requests run no heavy builds. The app gets an Android and an iPhone test build of `dev` each evening, skipped when `dev` has not changed.
- Every commit follows Conventional Commits; the commits set versions and changelogs. Pull requests into `dev` are rebase-merged, so each commit lands as is ([0008](https://github.com/pesaclarity/docs/blob/e0e3122b322c215b6a00b032b7b0246785025d2a/decisions/0008-dev-branch-and-release-please.md)).
- `pesaclarity-app`, `pesaclarity-backend`, `pesaclarity-ml` and `ujumbe-parsers` publish from `main`, so changes go to `dev` and reach `main` after QA ([0008](https://github.com/pesaclarity/docs/blob/e0e3122b322c215b6a00b032b7b0246785025d2a/decisions/0008-dev-branch-and-release-please.md)).
- Every repo links back here for the spec and brand.
