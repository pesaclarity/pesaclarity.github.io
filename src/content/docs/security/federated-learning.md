---
title: "Federated learning"
description: "Start when at least 300 opted-in installs are active weekly. Until then the server part stays undeployed."
section: "security"
order: 29
repo: "docs"
path: "spec/federated-learning.md"
commit: "a112d96fa86118401190906c2ed79939ecd2d233"
source: "https://github.com/pesaclarity/docs/blob/a112d96fa86118401190906c2ed79939ecd2d233/spec/federated-learning.md"
edit: "https://github.com/pesaclarity/docs/edit/main/spec/federated-learning.md"
---
**Status:** Accepted (step 1 built: pesaclarity/pesaclarity-ml#26, pesaclarity/pesaclarity-app#154) · **Date:** 2026-11-04 · **Issues:** pesaclarity/pesaclarity-backend#8, pesaclarity/pesaclarity-app#27, pesaclarity/pesaclarity-ml#3

## What exists

- **App:** the "Help improve the app" consent, and empty slots for three parts: an on-device trainer, a federated update trainer and an uploader (`lib/src/domain/categoriser/learning.dart`). Consent is checked before reading examples and again before sending.
- **ML (akili):** DP-SGD training, a Flower client and simulation, clipping and noise for updates, membership-inference audits and a release gate. Tracks set a minimum cohort: 100 phones for the app track, 1,000 for the commercial track.
- **Server (ngome):** a Flower server app with SecAgg+ (secure aggregation, so the server only sees the sum of updates) and DP settings, not yet deployed.

## What stands in the way

1. **Not enough phones yet.** A round needs at least 100 opted-in phones online at once, and more to cover drop-outs. The beta plans 30–50 users, so federated rounds cannot run during the beta. This is the privacy design working: small cohorts leak.
2. **No Flutter client for Flower.** Flower's secure aggregation runs in its Python client. The app is Flutter, so the phone side needs either a native client per platform or our own protocol and crypto, and that crypto would need an outside review.
3. **Training on the phone.** The exported TFLite model can only predict today. Training on the phone needs a model exported with training functions (`train`, `save`, `restore`) and a Dart runtime that calls them.

## Plan

### Step 1: learn on the phone only (now)

- akili exports the categoriser with TFLite training functions, checked against the Keras model in tests.
- The app fills the on-device trainer: after confirmations, it fine-tunes the installed model on the phone, keeps the trained weights in its encrypted storage, and uses them for suggestions.
- Nothing leaves the phone, so no new privacy risk and no server work. People see better suggestions for their own payees.
- Runs only with "Help improve the app" on, while charging, at most once a day.

### Step 2: federated rounds (when there are enough phones)

Start when at least 300 opted-in installs are active weekly. Until then the server part stays undeployed.

- The server loads the current global model, runs rounds, and saves each round's model with its privacy budget in MLflow.
- Clipping, noise and minimum cohort come from the privacy budget published with each akili release, never from defaults.
- Only opted-in, genuine installs take part (Play Integrity on Android, App Attest on iPhone).
- The transport needs a decision (below) before any build.

## Decisions needed

1. **Approve step 1** to build now.
2. **For step 2, choose how phones talk to the aggregator:**
   - **A. Native Flower clients** (Kotlin on Android, Swift on iPhone) behind a platform channel. This keeps Flower's tested secure aggregation, but only if those SDKs support it.
   - **B. Our own round API on ngome**, with secure aggregation written in Dart and Python. Full control, but new crypto that needs an outside review before launch.
   - **C. A Dart client for Flower's current message API**, porting Flower's client side of SecAgg+. The server keeps Flower's tested SecAgg+ workflow; only the phone's part is new code.
   - **Recommended:** C, decided at step 2. Choosing now buys nothing while the cohort is too small.

   **A checked (2026-11-05, Flower main):** A does not work as hoped.
   - Neither mobile SDK has any secure aggregation code (`framework/kotlin`, `framework/swift`).
   - The Kotlin SDK still speaks the old task API (`PullTaskIns`), which current Flower servers no longer have; they use `PullMessages` and `PushMessages`.
   - The Swift SDK uses the older two-way stream.

   So A would also mean writing the phone's side of SecAgg+, in two languages, against an outdated client. Flower's own client side is small: about 500 lines of Python (`secaggplus_mod.py`) plus Shamir secret sharing and Fernet encryption. Porting that once to Dart (C) keeps Flower's server and protocol. The port still needs an outside review, but less than B, where both sides would be new.
