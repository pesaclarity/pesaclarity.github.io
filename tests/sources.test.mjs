// Checks the docs and changelogs copied from the other repositories
// (tool/sync-sources.mjs), and how the changelogs are read. Needs no build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  inlineHtml,
  parseChangelog,
  summary,
  tidy,
} from "../src/lib/changelog.mjs";

const root = new URL("../", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const config = JSON.parse(read("tool/sources.json"));
const lock = JSON.parse(read("src/data/sources.lock.json"));

test("every copied file matches the lock, and nothing else is there", () => {
  const onDisk = [
    ...readdirSync(join(root, "src/content/docs"), { recursive: true })
      .filter((f) => String(f).endsWith(".md"))
      .map((f) => `src/content/docs/${f}`),
    ...readdirSync(join(root, "src/data/changes")).map(
      (f) => `src/data/changes/${f}`,
    ),
  ].sort();
  assert.deepEqual(onDisk, Object.keys(lock.files).sort());
  for (const [file, sha] of Object.entries(lock.files)) {
    const actual = createHash("sha256").update(read(file)).digest("hex");
    assert.equal(actual, sha, `${file} was edited by hand; run npm run sync`);
  }
});

test("every repository is pinned to a full commit", () => {
  for (const repo of Object.keys(config.repos)) {
    assert.match(lock.repos[repo]?.commit ?? "", /^[0-9a-f]{40}$/, repo);
  }
});

test("every docs page says where it came from", () => {
  for (const d of config.docs) {
    const text = read(`src/content/docs/${d.section}/${d.slug}.md`);
    const commit = lock.repos[d.repo].commit;
    assert.match(text, new RegExp(`^commit: "${commit}"$`, "m"), d.slug);
    assert.match(
      text,
      new RegExp(
        `^source: "https://github.com/pesaclarity/${d.repo.replace(".", "\\.")}/blob/${commit}/`,
        "m",
      ),
    );
  }
});

test("copied docs load nothing from other servers", () => {
  for (const file of Object.keys(lock.files)) {
    const text = read(file).replace(/```[\s\S]*?```/g, "");
    assert.doesNotMatch(text, /<img\b|<picture\b|<iframe\b|<script\b/i, file);
    assert.doesNotMatch(text, /!\[[^\]]*\]\(/, `${file} embeds an image`);
  }
});

test("the changelogs name no AI model", () => {
  const names =
    /\b(claude|anthropic|opus|sonnet|haiku|chatgpt|gpt-?\d|openai|gemini|gemma|llama|qwen|mistral|phi-\d|smollm\w*|deepseek)\b/i;
  for (const file of readdirSync(join(root, "src/data/changes"))) {
    const text = read(`src/data/changes/${file}`);
    assert.doesNotMatch(text, names, file);
  }
});

test("reads a release-please changelog", () => {
  const md = `# Changelog

## [0.3.0](https://github.com/o/r/compare/v0.2.0...v0.3.0) (2026-11-17)


### Features

* ask, on the phone ([#234](https://github.com/o/r/issues/234)) ([2ec9e43](https://github.com/o/r/commit/2ec9e4371709fe953a686fd3ae209a9a8f0c383f))

### Fixes

* amounts never split ([#242](https://github.com/o/r/issues/242)) ([57fb638](https://github.com/o/r/commit/57fb63822172b3f79b1c9d9e44028d31093fb16d))

## 0.1.0

First release.

- Pack format with \`pack.yaml\`.
- Parsing engine: amounts in integer cents.
`;
  const [newest, first] = parseChangelog(md);
  assert.equal(newest.version, "0.3.0");
  assert.equal(newest.date, "2026-11-17");
  assert.equal(
    newest.compare,
    "https://github.com/o/r/compare/v0.2.0...v0.3.0",
  );
  assert.deepEqual(
    newest.groups.map((g) => [g.title, g.changes.length]),
    [
      ["Features", 1],
      ["Fixes", 1],
    ],
  );
  assert.equal(
    tidy(newest.groups[0].changes[0].text),
    "ask, on the phone [#234](https://github.com/o/r/issues/234)",
  );
  assert.equal(first.version, "0.1.0");
  assert.equal(first.date, null);
  assert.equal(first.groups[0].title, "");
  assert.equal(first.groups[0].changes.length, 2);
  assert.equal(summary(first.groups[0].changes[1].text), "Parsing engine");
});

test("reads a hand-written Unreleased list with wrapped and nested items", () => {
  const md = `## Unreleased

- Small models in less memory: an int8 cache
  (\`RAYO_CACHE_INT8\`).

- rayo is a general runtime:
  - **Ops:** \`compare\` replaces
    \`mask\`.
`;
  const [next] = parseChangelog(md);
  assert.equal(next.version, null);
  const [a, b] = next.groups[0].changes;
  assert.equal(
    a.text,
    "Small models in less memory: an int8 cache (`RAYO_CACHE_INT8`).",
  );
  assert.deepEqual(b.children, ["**Ops:** `compare` replaces `mask`."]);
  assert.equal(summary(b.text), "rayo is a general runtime");
});

test("changelog Markdown becomes escaped HTML", () => {
  assert.equal(
    inlineHtml("a `<b>` **c** [#1](https://x.test/1) <i>"),
    'a <code>&lt;b&gt;</code> <strong>c</strong> <a href="https://x.test/1">#1</a> &lt;i&gt;',
  );
});
