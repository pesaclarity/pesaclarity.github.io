// Checks the built site in dist/ against the site's promises: no client JS
// beyond the inline theme switch and this site's own script files (search,
// and the docs' copy buttons and tabs), nothing loaded from other servers,
// and the basics every page needs.
// Run `npm run build` first.
import { test } from "node:test";
import { createHash } from "node:crypto";
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

test("the sponsor page gives with CitaPay, or SPONSOR_URL when set", () => {
  const html = pages.find((p) => p.name === "sponsor/index.html").html;
  assert.ok(html.includes("https://pay.citatech.cloud/legal/terms"));
  if (process.env.SPONSOR_URL) {
    assert.ok(html.includes(process.env.SPONSOR_URL));
  } else {
    assert.ok(
      html.includes('href="https://pay.citatech.cloud/pay/@pesaclarity"'),
    );
    assert.doesNotMatch(html, /data-sponsor="soon"/);
  }
  assert.match(html, /US\$99 a year/);
});

// Pages copied from other repositories or their changelogs: their words are
// theirs, so the checks on the site's own copy skip them.
const mirrored = (name) => /^(docs|changes)\//.test(name);

test("builds the expected pages", () => {
  const names = new Set(pages.map((p) => p.name));
  for (const name of [
    "404.html",
    "index.html",
    "features/index.html",
    "install/index.html",
    "privacy/index.html",
    "sponsor/index.html",
    "terms/index.html",
    "help/index.html",
    "docs/index.html",
    "changes/index.html",
    "security/index.html",
    "impact/index.html",
    // The parser-pack and rayo docs, end to end from their repositories.
    "docs/parser-packs/write-a-parser-pack/index.html",
    "docs/rayo/overview/index.html",
    "changes/rayo/index.html",
  ]) {
    assert.ok(names.has(name), `${name} is missing`);
  }
  const docs = readdirSync(new URL("../src/content/docs/", import.meta.url), {
    recursive: true,
  }).filter((f) => String(f).endsWith(".md"));
  for (const file of docs) {
    const page = `docs/${String(file).replace(/\.md$/, "")}/index.html`;
    assert.ok(names.has(page), `${page} is missing`);
  }
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

  test(`${name}: runs only the theme script, and search and docs from this site`, () => {
    const scripts = [
      ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
    ];
    const inline = scripts.filter((s) => !/\ssrc=/.test(s[1]));
    assert.equal(inline.length, 1, "one inline script, the theme switch");
    assert.equal(inline[0][1], "", "the theme script has no attributes");
    assert.match(inline[0][2], /data-theme-switch/);
    // Any other script is the search or the docs' controls, files of this
    // site, each on the pages that use it.
    for (const [, attrs, body] of scripts.filter((s) => /\ssrc=/.test(s[1]))) {
      assert.match(
        attrs,
        new RegExp(`src="${base}/_astro/(Search|DocBody|analyse)[^"]+\\.js"`),
      );
      assert.equal(body.trim(), "");
      if (/DocBody/.test(attrs)) assert.match(name, /^docs\/[^/]+\/[^/]+\//);
      else if (/analyse/.test(attrs)) assert.equal(name, "analyse/index.html");
      else assert.match(html, /data-search-input/);
    }
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

test("the docs have tabs, framed code, callouts and heading links", () => {
  const start = pages.find(
    (p) => p.name === "docs/rayo/getting-started/index.html",
  )?.html;
  assert.ok(start, "the rayo getting-started page is built");
  assert.match(start, /role="tablist"[^>]*hidden/);
  for (const tab of [">C<", ">Dart<", ">Python<"])
    assert.ok(start.includes(tab), tab);
  assert.match(start, /class="code-copy" data-copy hidden>Copy</);
  assert.match(start, /class="callout callout-note"/);
  assert.match(start, /class="heading-anchor" href="#c"/);
  assert.match(start, />Edit on GitHub</);
  const api = pages.find((p) => p.name === "docs/rayo/c-api/index.html")?.html;
  assert.ok(api, "the C API reference is built");
  assert.match(api, /<h3 id="rayo_model_load">/);
  assert.match(api, /href="#rayo_model_load"/, "listed under On this page");
  const body =
    start.match(
      /<div class="doc-body">([\s\S]*?)<\/div>\s*<div class="article-end"/,
    )?.[1] ?? "";
  // (Its own script is a file, after it: no inline script, no handler.)
  assert.doesNotMatch(body, /<script\b(?![^>]*\ssrc=)|\son[a-z]+="/i);
});

test("the Content-Security-Policy allows the theme script and search", () => {
  const hashes = new Set(
    pages.map(({ html }) => {
      const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
      return createHash("sha256").update(script).digest("base64");
    }),
  );
  assert.equal(hashes.size, 1, "every page has the same theme script");
  const [hash] = hashes;
  const netlify = readFileSync(
    new URL("../netlify.toml", import.meta.url),
    "utf8",
  );
  const csp = netlify.match(/Content-Security-Policy = "([^"]+)"/)?.[1];
  assert.ok(csp, "netlify.toml sets a Content-Security-Policy");
  const directives = Object.fromEntries(
    csp.split(";").map((d) => {
      const [name, ...values] = d.trim().split(/\s+/);
      return [name, values];
    }),
  );
  // Scripts: files of this site (search and Pagefind), WebAssembly for
  // Pagefind's index, and the inline theme script by its hash. Nothing else:
  // no 'unsafe-inline', no 'unsafe-eval', no other host.
  assert.deepEqual(
    [...directives["script-src"]].sort(),
    ["'self'", "'wasm-unsafe-eval'", `'sha256-${hash}'`].sort(),
    `netlify.toml needs script-src 'self' 'wasm-unsafe-eval' 'sha256-${hash}'`,
  );
  assert.deepEqual(directives["default-src"], ["'self'"]);
  assert.equal(directives["connect-src"], undefined, "fetches stay on 'self'");
  assert.deepEqual(directives["object-src"], ["'none'"]);
});

test("search: Pagefind's index is built, and help and docs are in it", () => {
  for (const file of ["pagefind/pagefind.js", "pagefind/pagefind-entry.json"]) {
    assert.ok(existsSync(join(dist, file)), `${file} is missing`);
  }
  const indexed = pages.filter((p) => /\sdata-pagefind-body/.test(p.html));
  const names = indexed.map((p) => p.name);
  assert.ok(names.includes("help/index.html"), "the common questions");
  assert.ok(names.some((n) => /^help\/[^/]+\/[^/]+\/index\.html$/.test(n)));
  assert.ok(names.includes("docs/parser-packs/write-a-parser-pack/index.html"));
  // The script loads Pagefind from this site, never from another server.
  const assets = join(dist, "_astro");
  const search = readdirSync(assets).find((f) => /^Search.*\.js$/.test(f));
  assert.ok(search, "the search script is built");
  const js = readFileSync(join(assets, search), "utf8");
  assert.match(js, /pagefind\/pagefind\.js/);
  assert.doesNotMatch(js, /https?:\/\//);
});

test("the search box shows only when scripts run; the topics stand in", () => {
  const help = pages.find((p) => p.name === "help/index.html").html;
  assert.match(help, /data-search-input/);
  // Every topic is a plain link, so help works with no script.
  const topics = help.match(/href="[^"]*\/help\/[a-z-]+\/"/g) ?? [];
  assert.ok(topics.length >= 8, "a link to each topic");
});

test("public pages carry no internal draft notes or doc paths", () => {
  for (const { name, html } of pages.filter((p) => !mirrored(p.name))) {
    assert.doesNotMatch(html, /\bdraft\b|pending legal review/i, name);
    assert.doesNotMatch(html, /PRODUCT-SPEC/, name);
  }
});

test("the support address is written once, in src/data/site.ts", () => {
  const site = readFileSync(
    new URL("../src/data/site.ts", import.meta.url),
    "utf8",
  );
  const address = site.match(/export const support = "([^"]+)"/)?.[1];
  assert.ok(address, "site.ts exports support");
  const help = pages.find((p) => p.name === "help/index.html").html;
  assert.ok(help.includes(`mailto:${address}`), "help links to it");
  const src = new URL("../src/", import.meta.url).pathname;
  for (const file of readdirSync(src, { recursive: true })) {
    if (!/\.(astro|ts|mjs|md)$/.test(String(file))) continue;
    if (String(file) === "data/site.ts") continue;
    const text = readFileSync(join(src, String(file)), "utf8");
    assert.ok(!text.includes(address), `${file} repeats the support address`);
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
  const expected = pages
    .filter((p) => p.name !== "404.html")
    .map((p) => `${base}/${p.name.replace(/index\.html$/, "")}`);
  assert.deepEqual(locs.sort(), expected.sort());
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

test("every internal link finds a page", () => {
  const names = new Set(pages.map((p) => p.name));
  for (const { name, html } of pages) {
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"#]+)/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const path = href.slice(base.length).replace(/^\//, "");
      if (!path.endsWith("/") && path !== "") continue; // files such as feeds
      assert.ok(
        names.has(`${path}index.html`),
        `${name}: ${href} points at no page`,
      );
    }
  }
});

test("every help topic has articles", () => {
  const help = pages.find((p) => p.name === "help/index.html").html;
  assert.doesNotMatch(help, /Articles coming/);
  const topics = new Set(
    pages
      .map((p) => p.name.match(/^help\/([^/]+)\/[^/]+\/index\.html$/)?.[1])
      .filter(Boolean),
  );
  for (const [, topic] of help.matchAll(/href="[^"]*\/help\/([a-z-]+)\/"/g)) {
    assert.ok(topics.has(topic), `help topic ${topic} has no article`);
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

const playListing =
  "https://play.google.com/store/apps/details?id=com.pesaclarity.app";

test("Android downloads go to Google Play, with the Play button", () => {
  for (const name of [
    "index.html",
    "features/index.html",
    "install/index.html",
  ]) {
    const page = pages.find((p) => p.name === name);
    assert.ok(page, name);
    assert.ok(page.html.includes(`href="${playListing}"`), name);
    assert.match(page.html, /Get it on Google Play/, name);
  }
  for (const { name, html } of pages) {
    assert.doesNotMatch(html, /play\.google\.com\/intl[^"]*badge/, name);
    assert.doesNotMatch(html, /pesaclarity-play-32bit\.apk/, name);
  }
});

test("home: the daily plan, with Android links only to Google Play", () => {
  const home = pages.find((p) => p.name === "index.html").html;
  assert.match(home, /<h1[^>]*>Your money has a plan now\.<\/h1>/);
  assert.match(home, /class="play-store/, "the Play button");
  // Every link to an app download on the home page goes to the Play listing.
  for (const [, href] of home.matchAll(/href="([^"]+)"/g)) {
    assert.doesNotMatch(href, /\.apk$|\/releases\/download\//, href);
    if (/play\.google\.com/.test(href)) assert.equal(href, playListing);
  }
  // The hero screen loads first; nothing is both high priority and lazy.
  for (const [img] of home.matchAll(/<img\b[^>]*>/g)) {
    if (/fetchpriority="high"/.test(img)) {
      assert.doesNotMatch(img, /loading="lazy"/, img);
    }
  }
  assert.match(home, /<img\b[^>]*fetchpriority="high"[^>]*>/);
  assert.doesNotMatch(home, /daily budget/);
});

test("the redesign mockups are not published", () => {
  assert.ok(!existsSync(join(dist, "mockups")), "dist/mockups/ exists");
  assert.ok(!pages.some((p) => p.name.startsWith("mockups/")));
});

test("the install page offers every download", () => {
  const install = pages.find((p) => p.name === "install/index.html");
  assert.ok(install);
  assert.match(install.html, />APK for testers</);
  for (const file of [
    "pesaclarity-play.apk",
    "pesaclarity-foss.apk",
    "pesaclarity-foss-32bit.apk",
  ]) {
    assert.match(install.html, new RegExp(`href="[^"]+/${file}"`), file);
  }
  assert.doesNotMatch(install.html, /about 20\s+MB/i);
});

test("sizes come from the release, never typed by hand", () => {
  for (const { name, html } of pages.filter((p) => !mirrored(p.name))) {
    assert.doesNotMatch(html, /\babout \d+\s*MB\b/i, name);
    for (const [size] of html.matchAll(/\b\d+(?:\.\d+)?\s*MB\b/g)) {
      assert.match(size, /^\d+\.\d MB$/, `${name}: ${size}`);
    }
  }
});

test("Impact: linked from every footer, with honest goals", () => {
  const impact = pages.find((p) => p.name === "impact/index.html");
  assert.ok(impact, "impact/index.html is built");
  const link = `href="${base}/impact/"`;
  const home = pages.find((p) => p.name === "index.html").html;
  assert.ok(home.includes(link), "the home page links to it");
  for (const { name, html } of pages) {
    const footer = html.match(/<footer\b[\s\S]*<\/footer>/)?.[0] ?? "";
    assert.ok(footer.includes(link), `${name}: the footer links to it`);
  }
  assert.match(
    impact.html,
    /not endorsed by or affiliated with the United Nations/,
  );
  assert.match(impact.html, /aims to contribute to/);
  assert.doesNotMatch(impact.html, /\bachieves\b/);
  for (const n of [1, 8, 10]) {
    assert.ok(
      impact.html.includes(`href="https://sdgs.un.org/goals/goal${n}"`),
      `goal ${n} cites its page on sdgs.un.org`,
    );
  }
});
