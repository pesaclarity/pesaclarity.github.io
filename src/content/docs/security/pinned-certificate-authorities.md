---
title: "Pinned certificate authorities"
description: "Date: 2026-10-27 · Status: Accepted"
section: "security"
order: 28
repo: "docs"
path: "decisions/0005-pin-certificate-authorities.md"
commit: "a112d96fa86118401190906c2ed79939ecd2d233"
source: "https://github.com/pesaclarity/docs/blob/a112d96fa86118401190906c2ed79939ecd2d233/decisions/0005-pin-certificate-authorities.md"
edit: "https://github.com/pesaclarity/docs/edit/main/decisions/0005-pin-certificate-authorities.md"
---
Date: 2026-10-27 · Status: Accepted

## Context

MASVS L2 expects certificate pinning. Our hosts (Cloud Run, Cloudflare) manage our certificates and renew them with new keys every 60 to 90 days, so pinning server keys would lock out every installed app at each renewal. Dart's TLS only exposes the server's own certificate, not the chain, so a key higher in the chain cannot be pinned. Options were: pin the authorities, run our own key behind a load balancer (about $18 a month plus key management), or not pin.

## Decision

Connections to our hosts trust only the root authorities named in the build (`PESACLARITY_PINNED_HOSTS` and `PESACLARITY_TRUSTED_ROOTS`, at least two roots). Third-party services such as Google Drive use the phone's authorities.

## Consequences

- Certificate renewals need no app update; a provider changing authority does, so ship a release trusting the new root before it switches.
- A misconfiguration refuses every connection to our hosts rather than turning pinning off.
- Less strict than key pinning: any certificate from a trusted authority for our host names is accepted.
