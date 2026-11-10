// Checks the built site in dist/ against the site's promises: no client JS,
// nothing loaded from other servers, and the basics every page needs.
// Run `npm run build` first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const base = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

assert.ok(existsSync(dist), "dist/ is missing; run `npm run build` first");
const pages = htmlFiles(dist).map((path) => ({
  name: relative(dist, path),
  html: readFileSync(path, "utf8"),
}));

test("builds the expected pages", () => {
  const names = pages.map((p) => p.name).sort();
  assert.deepEqual(names, [
    "404.html",
    "features/index.html",
    "index.html",
    "install/index.html",
    "privacy/index.html",
    "terms/index.html",
  ]);
});

for (const { name, html } of pages) {
  test(`${name}: has language, title, description and one h1`, () => {
    assert.match(html, /<html lang="en-KE"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
    assert.match(html, /<main id="main"/);
  });

  test(`${name}: has Open Graph tags and a favicon`, () => {
    for (const prop of ["og:title", "og:description", "og:image", "og:url"]) {
      assert.match(
        html,
        new RegExp(`<meta property="${prop}" content="[^"]+"`),
      );
    }
    assert.ok(
      html.includes(`<link rel="icon" href="${base}/favicon.svg"`),
      "favicon link",
    );
  });

  test(`${name}: ships no JavaScript`, () => {
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /\son[a-z]+="/i);
  });

  test(`${name}: loads nothing from other servers`, () => {
    const loads = [
      ...html.matchAll(
        /<(?:img|script|iframe|source|video|audio)\b[^>]*\ssrc="([^"]+)"/gi,
      ),
      ...html.matchAll(
        /<link\b(?=[^>]*\srel="(?:stylesheet|preload|modulepreload|icon|apple-touch-icon)")[^>]*\shref="([^"]+)"/gi,
      ),
    ].map((m) => m[1]);
    const external = loads.filter((url) => /^(https?:)?\/\//.test(url));
    assert.deepEqual(external, []);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
  });
}

test("public pages carry no internal draft notes or doc paths", () => {
  for (const { name, html } of pages) {
    assert.doesNotMatch(html, /\bdraft\b|pending legal review/i, name);
    assert.doesNotMatch(html, /PRODUCT-SPEC/, name);
  }
});

test("404 page is not indexed", () => {
  const notFound = pages.find((p) => p.name === "404.html");
  assert.ok(notFound);
  assert.match(notFound.html, /<meta name="robots" content="noindex"/);
});

test("sitemap lists the public pages and not the 404", () => {
  const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname,
  );
  assert.deepEqual(locs.sort(), [
    `${base}/`,
    `${base}/features/`,
    `${base}/install/`,
    `${base}/privacy/`,
    `${base}/terms/`,
  ]);
  assert.match(
    readFileSync(join(dist, "robots.txt"), "utf8"),
    /Sitemap: https?:\/\/\S+\/sitemap-index\.xml/,
  );
});

test("stylesheets use only self-hosted fonts", () => {
  const assets = join(dist, "_astro");
  const css = readdirSync(assets)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(assets, f), "utf8"))
    .join("\n");
  assert.match(css, /font-family:\s*["']?Space Grotesk/);
  assert.match(css, /font-family:\s*["']?Inter/);
  assert.doesNotMatch(css, /url\((["']?)(https?:)?\/\//);
  assert.doesNotMatch(css, /@import/);
});

test("internal links stay under the base path", () => {
  for (const { name, html } of pages) {
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      assert.ok(
        href.startsWith(`${base}/`),
        `${name}: link ${href} is outside ${base || "/"}`,
      );
    }
  }
});

test("every image has alt text and is in the build", () => {
  for (const { name, html } of pages) {
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(tag, /\salt="[^"]+"/, `${name}: ${tag} has no alt text`);
      const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
      assert.ok(src, `${name}: ${tag} has no src`);
      const file = join(dist, src.slice(base.length));
      assert.ok(existsSync(file), `${name}: ${src} is missing from dist/`);
    }
  }
});

test("links to a part of a page find it", () => {
  const ids = new Map(
    pages.map(({ name, html }) => [
      name,
      new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
    ]),
  );
  for (const { name, html } of pages) {
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]*#[^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [path, hash] = href.split("#");
      const target = path
        ? `${path.slice(base.length).replace(/^\//, "")}index.html`
        : name;
      assert.ok(ids.has(target), `${name}: ${href} points at no page`);
      assert.ok(
        ids.get(target).has(hash),
        `${name}: ${href} finds no #${hash}`,
      );
    }
  }
});

test("the install page offers every download", () => {
  const install = pages.find((p) => p.name === "install/index.html");
  assert.ok(install);
  for (const file of [
    "pesaclarity-play.apk",
    "pesaclarity-play-32bit.apk",
    "pesaclarity-foss.apk",
    "pesaclarity-foss-32bit.apk",
  ]) {
    assert.match(install.html, new RegExp(`href="[^"]+/${file}"`), file);
  }
  assert.doesNotMatch(install.html, /about 20\s+MB/i);
});

test("sizes come from the release, never typed by hand", () => {
  for (const { name, html } of pages) {
    assert.doesNotMatch(html, /\babout \d+\s*MB\b/i, name);
    for (const [size] of html.matchAll(/\b\d+(?:\.\d+)?\s*MB\b/g)) {
      assert.match(size, /^\d+\.\d MB$/, `${name}: ${size}`);
    }
  }
});
