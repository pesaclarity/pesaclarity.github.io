import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { createCssVariablesTheme } from "shiki";

// SITE_URL wins; on Netlify, URL is the site's primary address.
const site =
  process.env.SITE_URL ?? process.env.URL ?? "https://pesaclarity.github.io";

// Code in the docs is highlighted when the site is built, with colours
// from tokens.css (--code-*), so it follows the theme and needs no script.
const codeTheme = createCssVariablesTheme({
  name: "pesaclarity",
  variablePrefix: "--code-",
  fontStyle: true,
});

export default defineConfig({
  site,
  base: process.env.BASE_PATH ?? "/",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory" },
  markdown: {
    shikiConfig: { theme: codeTheme, wrap: false },
  },
  // Scripts stay in files (never inline), so the Content-Security-Policy
  // can allow them by 'self'; only the theme script is inline, by its hash.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap({ filter: (page) => !page.includes("/404") })],
});
