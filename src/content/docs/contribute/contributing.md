---
title: "Contributing"
description: "Thanks for helping. This guide applies to every repository in the organisation; a repo's own CONTRIBUTING.md adds setup and checks specific to it."
section: "contribute"
order: 42
repo: ".github"
path: "CONTRIBUTING.md"
commit: "26f5c711ade04a1b2e3685d4542c91be05eb8079"
source: "https://github.com/pesaclarity/.github/blob/26f5c711ade04a1b2e3685d4542c91be05eb8079/CONTRIBUTING.md"
edit: "https://github.com/pesaclarity/.github/edit/main/CONTRIBUTING.md"
---
Thanks for helping. This guide applies to every repository in the organisation; a repo's own `CONTRIBUTING.md` adds setup and checks specific to it.

## Before you start

- Read the [product spec](https://github.com/pesaclarity/docs/blob/main/spec/PRODUCT-SPEC.md). Changes that go against its principles (no ads, data stays on the phone, honest money maths) will not be merged.
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Be kind. Everyone here follows the [code of conduct](/docs/contribute/code-of-conduct/).

## Never commit

- Real SMS messages, statements, phone numbers, names or account numbers. Test data must be synthetic or fully anonymised. Pull requests containing real personal data are closed and the history is purged.
- Secrets of any kind: API keys, signing keys, `.env` files, keystores.

## Pull requests

1. Fork the repo and branch from `dev` in the app, server, ML and parser repos (`main` elsewhere).
2. Keep each pull request to one change. Small is easier to review.
3. Add or update tests. Run the repo's checks before you push: `tool/setup-hooks` once installs a pre-push hook that runs `tool/check` (format, lint, tests). GitHub Actions only builds, releases and deploys.
4. Write every commit in [Conventional Commits](https://www.conventionalcommits.org) form: `feat: add KCB paybill rule`, `fix: …`, `feat!: …` for a breaking change, or `docs`, `test`, `ci`, `chore`, `refactor`, `build`, `perf`, `style`, `revert`. Pull requests into `dev` are rebase-merged, so each commit lands on `dev` as is, and release-please sets the next version and changelog from the commits, not the pull request title.
   - Changes users can see are `feat` or `fix`; a privacy policy text change, for example, is a `fix` and releases as a patch.
   - Review follow-ups users don't see use a hidden type (`refactor`, `test`, `style`, `chore`, `docs`, `ci`, `build`), so the changelog stays clean. Pushed history is never rewritten, so write them as new commits, not `fixup!`, `squash!` or `amend!` ones; the pre-push hook rejects those.
   - One logical change per commit, in the imperative, with a short body when the reason isn't obvious.
5. Fill in the pull request template. If the change alters the spec, how something is set up or deployed, or makes a decision that is expensive to reverse, open a matching pull request in [docs](https://github.com/pesaclarity/docs) (the spec, or a record in `decisions/`), so the docs never fall behind the code.

Changes land through reviewed pull requests whose local checks pass; never force-push. In `pesaclarity-app`, `pesaclarity-backend`, `pesaclarity-ml` and `ujumbe-parsers`, `main` is what users get: pull requests go to `dev`, and `dev` reaches `main` only after the checks pass and QA approves (merged with a merge commit), after which release-please tags the release ([0008](https://github.com/pesaclarity/docs/blob/main/decisions/0008-dev-branch-and-release-please.md)).

## Code style

- Follow the formatter and linter configured in each repo; `tool/check` runs them before every push.
- Prefer clear names over comments. Comment only to explain why, not what.
- Public APIs get short doc comments.

## Licensing of contributions

Each repo states its licence in `LICENSE`:

- `pesaclarity-app`, `pesaclarity-backend`, `pesaclarity-ml`, `pesaclarity.github.io` code: AGPL-3.0
- `ujumbe-parsers`: Apache-2.0
- `docs`, `.github`, website text: CC BY 4.0

You keep the copyright in your contribution and license it under the repo's licence. The AGPL repos will also offer a commercial licence on request, which funds keeping the app free; for that, contributions to those repos will need a contributor licence agreement. Until the agreement is published, maintainers will ask before merging outside code into the AGPL repos.

The Pesa Clarity name and logo are trademarks and are not licensed for forks.

## Security issues

Do not open public issues for vulnerabilities. See [SECURITY.md](/docs/security/security-policy/).
