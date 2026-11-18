// The map from the app's screenshots to public/screens/ (tool/app-screens.json)
// covers every screen the site shows, so a refresh never leaves one behind.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(
  readFileSync(new URL("tool/app-screens.json", root), "utf8"),
);
const mapped = new Set(Object.values(config.screens));

test("every WebP in public/screens comes from an app screenshot", () => {
  const files = readdirSync(new URL("public/screens/", root))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/\.webp$/, ""));
  for (const file of files)
    assert.ok(mapped.has(file), `${file}.webp is not in tool/app-screens.json`);
});

test("every screen in src/data/site.ts is mapped", () => {
  const site = readFileSync(new URL("src/data/site.ts", root), "utf8");
  const files = [...site.matchAll(/file: "([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(files.length > 0);
  for (const file of files)
    assert.ok(mapped.has(file), `${file} is not in tool/app-screens.json`);
});

test("the screens keep the site's size", () => {
  assert.equal(config.width, 780);
  assert.equal(config.height, 1688);
  assert.equal(config.theme, "light");
});
