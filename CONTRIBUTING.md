# Contributing to pesaclarity-web

Thank you for helping. The code of conduct, security policy and general contributing guide are the organisation defaults in [pesaclarity/.github](https://github.com/pesaclarity/.github); this file covers only what is specific to the website.

## Scope

The site explains what Pesa Clarity is. Changes that add app features, accounts, forms that collect data, analytics, cookies, third-party scripts, embeds or external font and asset hosts will not be accepted. Copy follows the voice in [BRAND.md](https://github.com/pesaclarity/docs/blob/main/BRAND.md): plain, calm, specific, Kenyan English, no emoji. Claims about privacy or features must match the [product spec](https://github.com/pesaclarity/docs/blob/main/spec/PRODUCT-SPEC.md).

## Setup

```sh
npm ci
npm run dev
```

## Checks run on your machine

GitHub only builds and deploys the site; the checks run locally. Once, after cloning:

```sh
tool/setup-hooks
```

Then every push runs `tool/check`: format, `astro check`, build and the built-site tests. Run it by hand at any time, or `tool/check --fast` (format, `astro check`, unit tests) while you work; `npm run format` fixes formatting. In an emergency, skip the hook with `git push --no-verify`.

## Before opening a pull request

Run `tool/check`, then also check the page at phone width (375 px) and desktop width, in light and dark mode, and with keyboard only.

- Colours, type and sizes come from `src/styles/tokens.css`. Add a token there rather than a raw value in a component.
- Keep text contrast at 4.5:1 or more and touch targets at 44 px or more.
- Keep commits small with one-line messages. Describe what changed and why in the pull request.
- By contributing, you agree your code is licensed under AGPL-3.0 and your text and images under CC BY 4.0.
