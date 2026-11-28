// Checks that an app screen with a dark version is shown as a light and dark
// pair. Builds the site into a temporary folder with a temporary
// public/screens/home-dark.webp (a copy of home.webp) unless a real one is
// there, then removes what it made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const screens = join(root, "public", "screens");
const base = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");

function imgs(html) {
  return [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => {
    const attr = (name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    return {
      src: attr("src"),
      alt: attr("alt"),
      width: attr("width"),
      height: attr("height"),
      loading: attr("loading"),
      cls: (attr("class") ?? "").split(/\s+/),
    };
  });
}

test("a screen with a dark version renders as a light and dark pair", () => {
  const darkFile = join(screens, "home-dark.webp");
  const made = !existsSync(darkFile);
  const out = mkdtempSync(join(tmpdir(), "pesaclarity-dark-"));
  try {
    if (made) copyFileSync(join(screens, "home.webp"), darkFile);
    execFileSync("npx", ["astro", "build", "--outDir", out], {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    });
    const html = readFileSync(join(out, "index.html"), "utf8");
    const all = imgs(html);
    const light = all.filter((i) => i.src === `${base}/screens/home.webp`);
    const dark = all.filter((i) => i.src === `${base}/screens/home-dark.webp`);
    assert.ok(light.length > 0, "the home screen is on the home page");
    assert.equal(
      dark.length,
      light.length,
      "each light image has its dark one",
    );
    for (const [i, l] of light.entries()) {
      const d = dark[i];
      assert.ok(l.cls.includes("screen-light"), "light image is marked");
      assert.ok(d.cls.includes("screen-dark"), "dark image is marked");
      assert.equal(d.alt, l.alt);
      assert.equal(d.width, l.width);
      assert.equal(d.height, l.height);
      assert.equal(d.loading, "lazy", "the hidden image is never fetched");
    }
    // The hero's light screen loads at once, so the first view never
    // waits (in dark mode that one light file is fetched too).
    assert.equal(light[0].loading, undefined, "the hero loads at once");
    // Besides the hero, only the first screen in a sideways row loads at
    // once, so it never shows blank; the rest stay lazy.
    const eager = all.filter(
      (i) => i.cls.includes("screen-light") && i.loading !== "lazy",
    );
    assert.ok(eager.length <= 2, `${eager.length} light screens load at once`);
    // A screen with no dark file stays a single, unmarked image.
    for (const i of all) {
      const name = i.src?.match(/\/screens\/([^/]+)\.webp$/)?.[1];
      if (!name || name.endsWith("-dark")) continue;
      if (existsSync(join(screens, `${name}-dark.webp`))) continue;
      assert.ok(!i.cls.includes("screen-light"), `${name} has no dark pair`);
    }
    const css = readdirSync(join(out, "_astro"))
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(join(out, "_astro", f), "utf8"))
      .join("\n");
    assert.match(css, /\[data-theme=["']?dark["']?\][^{]*\.screen-dark/);
    assert.match(
      css,
      /:not\(\[data-theme=["']?light["']?\]\)[^{]*\.screen-light/,
    );
  } finally {
    if (made) rmSync(darkFile, { force: true });
    rmSync(out, { recursive: true, force: true });
  }
});
