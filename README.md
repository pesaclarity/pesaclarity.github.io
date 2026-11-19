# pesaclarity.github.io

The public website for [Pesa Clarity](https://github.com/pesaclarity), a free, ad-free, open-source app for Android and iPhone that turns M-Pesa and bank messages into a daily plan, with all analysis on the phone. The site says what Pesa Clarity is, what it believes, exactly what stays on the phone, why it is open source, and how to join the beta or contribute. It also carries the help centre, the developer docs (copied from each repository) and the release notes of every part. It has no app features, no accounts, no cookies and no analytics. Its only scripts are one small inline script for the colour theme switch (System, Light or Dark), kept in the browser, and search on the help and docs pages, which runs in the browser from an index built with the site.

Codename **dirisha**, Swahili for "window": the project's window to the public.

Status: **pre-alpha**. The spec and brand live in [pesaclarity/docs](https://github.com/pesaclarity/docs).

## Quick start

Needs Node.js 22.23.4 or later (`.nvmrc` pins 24) and npm.

```sh
npm ci
npm run dev       # http://localhost:4321
```

| Command                           | What it does                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Local dev server                                                                                                                                                                                 |
| `npm run build`                   | Static build into `dist/`                                                                                                                                                                        |
| `npm run preview`                 | Serve `dist/` locally                                                                                                                                                                            |
| `npm run check`                   | Type and template checks (`astro check`, TypeScript strict)                                                                                                                                      |
| `npm run format` / `format:check` | Prettier, with the Astro plugin                                                                                                                                                                  |
| `npm test`                        | Checks the built site: only the theme script and search, the Content-Security-Policy, nothing loaded from other servers, titles, Open Graph, sitemap, the copied docs. Run after `npm run build` |
| `npm run sync`                    | Copies the docs and changelogs from the other repositories again, at the pinned commits (`-- --update` moves the pins). See below                                                                |

`tool/check` runs the format check, `astro check`, build and the tests; the git hooks run it for you (see CONTRIBUTING.md).

## Project layout

```
public/              favicon, touch icon, Open Graph image, logo SVGs (from pesaclarity/docs)
public/screens/      app screens, 780 × 1688 WebP (<name>-dark.webp for dark mode), listed in src/data/site.ts
src/styles/tokens.css  every design token (colours light and dark, type, radii, sizes)
src/styles/global.css  base styles and shared classes
src/data/site.ts     links, the support address, feature lists, screens and FAQ
src/data/help.ts     help topics; src/data/docs.ts: docs sections
src/content/help/    help articles, Markdown, one folder per topic
src/content/docs/    developer docs, copied from the other repositories (do not edit here)
src/data/changes/    each product's CHANGELOG.md, copied the same way
src/data/sources.lock.json  the commit each repository was copied from, and file hashes
src/components/      header, footer, theme switch, search, logo mark
src/layouts/         Base.astro (page shell: meta, fonts, skip link); Article.astro (help and docs pages)
src/pages/           index, features, install, help/, docs/, changes/, security, sponsor, privacy, terms, 404, robots.txt
tests/               checks on the built output, the copied sources and the changelog reader
tool/sources.json    what tool/sync-sources.mjs copies, and from where
tool/app-screens.*   turns the app's screenshots into public/screens/ (below)
```

Design follows [BRAND.md](https://github.com/pesaclarity/docs/blob/main/BRAND.md) and `brand/tokens.json`. Fonts are self-hosted from `@fontsource`; nothing is fetched from a font CDN. Dark mode follows `prefers-color-scheme`.

## Configuration

`SITE_URL` sets the absolute URL used for canonical links, Open Graph and the sitemap. The domain is not decided yet, so it defaults to `https://pesaclarity.github.io`. See `.env.example`.

The download buttons point to the app's APKs on GitHub Releases (`downloads` in `src/data/site.ts`). They use the `test-build` pre-release until the first full release; set `APP_RELEASE_TAG` at build time to a tag such as `v0.2.0`, or `latest`, to change that. When it builds, the site reads that release from the GitHub API and shows its version and date under the buttons (`src/data/release.mjs`); with no network it shows none. The app's APK workflow triggers a rebuild (`repository_dispatch` of type `app-build`) after each build it publishes.

## App screens

The screens in `public/screens/` come from the app itself. The app's `Screenshots` workflow draws them from its own widgets with made-up records (pesaclarity-app README, Screenshots), light and dark, 1170 × 2532, and keeps them with a `manifest.json` on a rolling pre-release: [`screenshots`](https://github.com/pesaclarity/pesaclarity-app/releases/tag/screenshots) for its `dev` branch and [`screenshots-main`](https://github.com/pesaclarity/pesaclarity-app/releases/tag/screenshots-main) for `main`. When a screen changes it sends this repository a `repository_dispatch` of type `screenshots-updated`.

`.github/workflows/app-screens.yml` then downloads the PNGs and the manifest, and `tool/app-screens.mjs` checks each against its SHA-256 and writes it as a 780 × 1688 WebP (quality 82, as before) under the name `tool/app-screens.json` gives it: `<name>.webp` for the light theme and `<name>-dark.webp` for the dark one, which the site shows in dark mode. Only files whose bytes change are written, and the workflow opens or updates one pull request, `content: app screenshots from <commit>`, on the `content/app-screenshots` branch. Nothing is merged on its own: check the images, and the alt text in `src/data/site.ts` when a screen shows something new. A screen the app no longer draws keeps its current image, with a warning.

Run it by hand from Actions › App screens › Run workflow (choose the release), or locally:

```sh
gh release download screenshots --repo pesaclarity/pesaclarity-app --dir /tmp/app-screens --pattern manifest.json --pattern '*.png'
node tool/app-screens.mjs /tmp/app-screens
```

The workflow uses its own `GITHUB_TOKEN`, so Settings › Actions › General must allow GitHub Actions to create pull requests. The app's dispatch needs its `WEB_DISPATCH_TOKEN` (a fine-grained token for this repository with Contents read and write), the same one its APK workflow uses. `tests/app-screens.test.mjs` checks that every screen the site shows has a mapping.

## Help articles

Help articles are Markdown in `src/content/help/<topic>/<article>.md`, with `title`, `description`, `order` and `updated` in the front matter (and optionally an app `screen` from `src/data/site.ts`). Write them from the app's own screens, using the button and screen names the app shows (check them in `pesaclarity-app`'s `lib/`), and only made-up records. The topics are in `src/data/help.ts`. The support address is `support` in `src/data/site.ts`, the only place it is written.

## Docs and release notes

The developer docs at `/docs/` and the release notes at `/changes/` come from each repository's own files: the docs from their READMEs and `docs/` folders, the notes from their `CHANGELOG.md`. They are copied into this repository, not fetched while the site builds, so a build needs no network and always gives the same pages.

- `tool/sources.json` lists every page (repository, path, section, title; `only` or `omit` take one part of a file) and every changelog.
- `npm run sync` (`node tool/sync-sources.mjs`) copies them from `raw.githubusercontent.com` at the commits pinned in `src/data/sources.lock.json`; `npm run sync -- --update` first moves each pin to the newest commit of its branch. Relative links point at the copied page or at the file on GitHub at that commit, and images become links, so the site still loads nothing from other servers.
- `.github/workflows/sources.yml` runs `--update` weekly (or by hand, or on a `sources-updated` dispatch), builds and tests the site, and opens one pull request, `content: docs and release notes from the other repositories`, when anything changed.
- `tests/sources.test.mjs` checks every copied file against its hash in the lock, so a hand edit fails: change the page in its own repository instead. It also checks that no changelog names an AI model; `rewrite` in `tool/sources.json` rewords such a line.

A version with no date in its changelog heading takes the date of its tag on GitHub; `dates` in `tool/sources.json` fills in versions with no tag on GitHub.

## Contributors

`/contributors/` lists who has contributed to the organisation's eight repositories: commits on each default branch, merged pull requests, repositories, and first and latest contribution, by GitHub account. `npm run contributors` (`node tool/contributors.mjs`) reads them from the GitHub API into `src/data/contributors.json` and saves each GitHub picture to `public/contributors/` (people without one get initials). It reads no email addresses and leaves out bots: `[bot]` accounts, dependabot, release-please, github-actions, renovate and coding agents. The Pages workflow runs it before every build, on push and daily, with its own `GITHUB_TOKEN`; if GitHub cannot be reached it keeps the committed file, so commit a fresh run now and then. `tests/contributors.test.mjs` checks the file holds no email address and no bot, and that the page renders.

## Search

Search on the help and docs pages uses [Pagefind](https://pagefind.app). `npm run build` runs `pagefind --site dist` after Astro, which indexes the parts of pages marked `data-pagefind-body` (help articles, the common questions, the security page and the docs) into `dist/pagefind/`. In the browser, `src/components/Search.astro` loads that index from this site when someone types; nothing typed leaves the page. Pagefind runs WebAssembly, so the Content-Security-Policy in `netlify.toml` allows `script-src 'self' 'wasm-unsafe-eval'` plus the theme script's hash, and `tests/dist.test.mjs` checks exactly that. Without scripts the search box stays hidden and the topic and section lists stand in.

## Deploying

The build is plain static files in `dist/` served from the site root, so any static host works. No deploy workflow is included.

- **Netlify:** import the repository; `netlify.toml` sets the build, Node 24 and security headers, and Netlify's `URL` is used as the site address unless `SITE_URL` is set.
- **Cloudflare Pages:** build command `npm run build`, output directory `dist`, environment variables `NODE_VERSION=24` and `SITE_URL=<your domain>`.
- **GitHub Pages (used now):** `.github/workflows/pages.yml` builds and deploys on every push to `main`. It sets `SITE_URL` and `BASE_PATH` from the Pages settings, so the site works at `https://pesaclarity.github.io` (this repository is the organisation's Pages site, served from the root) and moves to a custom domain without code changes. Needs the repository public and Settings > Pages > Source set to "GitHub Actions".

Most hosts serve `404.html` for missing paths automatically.

## Get involved

- **Star [the app](https://github.com/pesaclarity/pesaclarity-app)** so more people find a private money app that runs on their phone.
- Help with copy, accessibility and Swahili translations is welcome.
- **Pick a first issue:** [good first issues](https://github.com/pesaclarity/pesaclarity.github.io/issues?q=is%3Aopen+label%3A%22good+first+issue%22) or [help wanted](https://github.com/pesaclarity/pesaclarity.github.io/issues?q=is%3Aopen+label%3A%22help+wanted%22).
- **Read [CONTRIBUTING.md](CONTRIBUTING.md)** before your first pull request. Never include real messages, statements or phone numbers.

## Licence

- Code: [AGPL-3.0](LICENSE).
- Site text and images: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- The Pesa Clarity name and logo are trademarks and are not covered by either licence.

Details in [CONTENT-LICENSE.md](CONTENT-LICENSE.md).
