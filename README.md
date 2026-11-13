# pesaclarity-web

The public website for [Pesa Clarity](https://github.com/pesaclarity), a free, ad-free, open-source app for Android and iPhone that turns M-Pesa and bank messages into a daily plan, with all analysis on the phone. The site says what Pesa Clarity is, what it believes, exactly what stays on the phone, why it is open source, and how to join the beta or contribute. It has no app features, no accounts, no cookies, no analytics and no client-side JavaScript.

Codename **dirisha**, Swahili for "window": the project's window to the public.

Status: **pre-alpha**. The spec and brand live in [pesaclarity/docs](https://github.com/pesaclarity/docs).

## Quick start

Needs Node.js 22.23.4 or later (`.nvmrc` pins 24) and npm.

```sh
npm ci
npm run dev       # http://localhost:4321
```

| Command                           | What it does                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Local dev server                                                                                                                |
| `npm run build`                   | Static build into `dist/`                                                                                                       |
| `npm run preview`                 | Serve `dist/` locally                                                                                                           |
| `npm run check`                   | Type and template checks (`astro check`, TypeScript strict)                                                                     |
| `npm run format` / `format:check` | Prettier, with the Astro plugin                                                                                                 |
| `npm test`                        | Checks the built site: no JavaScript, nothing loaded from other servers, titles, Open Graph, sitemap. Run after `npm run build` |

`tool/check` runs the format check, `astro check`, build and the tests; the git hooks run it for you (see CONTRIBUTING.md).

## Project layout

```
public/              favicon, touch icon, Open Graph image, logo SVGs (from pesaclarity/docs)
public/screens/      app screens, 780 × 1688 WebP, listed in src/data/site.ts
src/styles/tokens.css  every design token (colours light and dark, type, radii, sizes)
src/styles/global.css  base styles and shared classes
src/data/site.ts     links, feature lists, screens and FAQ
src/components/      header, footer, logo mark
src/layouts/Base.astro  page shell: SEO and Open Graph meta, fonts, skip link
src/pages/           index (landing), features, install, sponsor, privacy, terms, 404, robots.txt
tests/               checks on the built output
```

Design follows [BRAND.md](https://github.com/pesaclarity/docs/blob/main/BRAND.md) and `brand/tokens.json`. Fonts are self-hosted from `@fontsource`; nothing is fetched from a font CDN. Dark mode follows `prefers-color-scheme`.

## Configuration

`SITE_URL` sets the absolute URL used for canonical links, Open Graph and the sitemap. The domain is not decided yet, so it defaults to `https://pesaclarity.github.io`. See `.env.example`.

The download buttons point to the app's APKs on GitHub Releases (`downloads` in `src/data/site.ts`). They use the `test-build` pre-release until the first full release; set `APP_RELEASE_TAG` at build time to a tag such as `v0.2.0`, or `latest`, to change that. When it builds, the site reads that release from the GitHub API and shows its version and date under the buttons (`src/data/release.mjs`); with no network it shows none. The app's APK workflow triggers a rebuild (`repository_dispatch` of type `app-build`) after each build it publishes.

## Deploying

The build is plain static files in `dist/` served from the site root, so any static host works. No deploy workflow is included.

- **Netlify:** import the repository; `netlify.toml` sets the build, Node 24 and security headers, and Netlify's `URL` is used as the site address unless `SITE_URL` is set.
- **Cloudflare Pages:** build command `npm run build`, output directory `dist`, environment variables `NODE_VERSION=24` and `SITE_URL=<your domain>`.
- **GitHub Pages (used now):** `.github/workflows/pages.yml` builds and deploys on every push to `main`. It sets `SITE_URL` and `BASE_PATH` from the Pages settings, so the site works at `https://pesaclarity.github.io/pesaclarity-web/` and moves to a custom domain without code changes. Needs the repository public and Settings > Pages > Source set to "GitHub Actions".

Most hosts serve `404.html` for missing paths automatically.

## Get involved

- **Star [the app](https://github.com/pesaclarity/pesaclarity-app)** so more people find a private money app that runs on their phone.
- Help with copy, accessibility and Swahili translations is welcome.
- **Pick a first issue:** [good first issues](https://github.com/pesaclarity/pesaclarity-web/issues?q=is%3Aopen+label%3A%22good+first+issue%22) or [help wanted](https://github.com/pesaclarity/pesaclarity-web/issues?q=is%3Aopen+label%3A%22help+wanted%22).
- **Read [CONTRIBUTING.md](CONTRIBUTING.md)** before your first pull request. Never include real messages, statements or phone numbers.

## Licence

- Code: [AGPL-3.0](LICENSE).
- Site text and images: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- The Pesa Clarity name and logo are trademarks and are not covered by either licence.

Details in [CONTENT-LICENSE.md](CONTENT-LICENSE.md).
