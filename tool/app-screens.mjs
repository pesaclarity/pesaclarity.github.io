#!/usr/bin/env node
// Turns the app's screenshots into the site's screens.
//
//   node tool/app-screens.mjs <dir>
//
// <dir> holds manifest.json and the PNGs from the app's tool/screenshots.sh
// (the `screenshots` or `screenshots-main` release of pesaclarity-app).
// tool/app-screens.json maps each app screen to its file in public/screens/
// and sets the size and WebP quality. Each screen is written once per theme:
// `<file>.webp` for light and `<file>-dark.webp` for dark (the suffixes are
// in `themes`), which the site shows when it is in dark mode. A file is only rewritten when its
// bytes change; screens the app did not draw keep their current image.
// Prints what changed, and `changed=<count>` and `commit=<sha>` to
// $GITHUB_OUTPUT when it is set.
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = new URL("..", import.meta.url).pathname;
const dir = process.argv[2];
if (!dir) {
  console.error("usage: node tool/app-screens.mjs <dir>");
  process.exit(2);
}

const config = JSON.parse(
  readFileSync(join(root, "tool/app-screens.json"), "utf8"),
);
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
if (manifest.version !== 1 || !Array.isArray(manifest.screens)) {
  console.error("manifest.json is not a version 1 screenshots manifest");
  process.exit(1);
}

/** The app's PNG for `name` in `theme`, checked against its hash. */
function source(name, theme) {
  const entry = manifest.screens.find(
    (s) => s.name === name && s.theme === theme,
  );
  if (!entry) return null;
  if (!/^[a-z0-9-]+\.png$/.test(entry.file)) {
    throw new Error(`unexpected file name in manifest: ${entry.file}`);
  }
  const path = join(dir, entry.file);
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== entry.sha256)
    throw new Error(`${entry.file} does not match the manifest`);
  return bytes;
}

const changed = [];
const missing = [];
for (const [theme, suffix] of Object.entries(config.themes)) {
  for (const [name, file] of Object.entries(config.screens)) {
    const png = source(name, theme);
    if (!png) {
      missing.push(`${theme} ${name}`);
      continue;
    }
    const webp = await sharp(png)
      .resize(config.width, config.height, { kernel: "lanczos3" })
      .flatten({ background: theme === "dark" ? "#000000" : "#ffffff" })
      .webp({ quality: config.quality, effort: 6 })
      .toBuffer();
    const target = join(root, "public/screens", `${file}${suffix}.webp`);
    if (existsSync(target) && readFileSync(target).equals(webp)) continue;
    writeFileSync(target, webp);
    changed.push(`${file}${suffix}.webp`);
  }
}

const commit = /^[0-9a-f]{40}$/.test(manifest.commit ?? "")
  ? manifest.commit
  : "";
for (const name of missing) {
  console.warn(`warning: the app drew no ${name}; kept the current image`);
}
console.log(
  changed.length
    ? `Updated ${changed.length} screens from ${commit.slice(0, 7) || "the app"}: ${changed.join(", ")}`
    : "No screen changed.",
);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `changed=${changed.length}\ncommit=${commit}\n`,
  );
}
