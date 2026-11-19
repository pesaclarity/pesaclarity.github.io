// Checks the Contributors page and its data: no email addresses, no bots,
// every picture present, and the page built from it.
// Run `npm run build` first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { isBot, repos } from "../tool/contributors.mjs";

const root = new URL("../", import.meta.url);
const raw = readFileSync(new URL("src/data/contributors.json", root), "utf8");
const data = JSON.parse(raw);
const site = readFileSync(new URL("src/data/site.ts", root), "utf8");
const support = site.match(/export const support = "([^"]+)"/)?.[1];
const emailPattern = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

test("bots are told apart from people", () => {
  for (const login of [
    "dependabot[bot]",
    "github-actions[bot]",
    "release-please[bot]",
    "renovate[bot]",
    "renovate",
    "dependabot",
    "release-please",
    "github-actions",
    "claude",
  ]) {
    assert.ok(isBot({ login, type: "User" }), `${login} is a bot`);
  }
  assert.ok(isBot({ login: "some-app", type: "Bot" }));
  assert.ok(isBot(null), "a commit with no GitHub account is left out");
  assert.ok(!isBot({ login: "Dan-njuguna", type: "User" }));
  assert.ok(!isBot({ login: "mevolkan", type: "User" }));
});

test("the contributors file holds no email address", () => {
  assert.deepEqual(raw.match(emailPattern) ?? [], []);
  assert.ok(!/"e-?mail"/i.test(raw), "no email field");
});

test("the contributors file lists no bots", () => {
  assert.ok(data.contributors.length > 0, "someone is listed");
  for (const c of data.contributors) {
    assert.ok(!isBot({ login: c.login, type: "User" }), `${c.login} is a bot`);
  }
});

test("the contributors file covers every repository, in its shape", () => {
  assert.deepEqual(data.repos, Object.values(repos));
  assert.match(data.counted, /^\d{4}-\d{2}-\d{2}$/);
  for (const c of data.contributors) {
    assert.deepEqual(
      Object.keys(c).sort(),
      ["avatar", "commits", "first", "latest", "login", "name", "prs", "repos"],
      c.login,
    );
    assert.ok(Number.isInteger(c.commits) && Number.isInteger(c.prs));
    for (const r of c.repos) assert.ok(data.repos.includes(r), r);
    if (c.avatar) {
      assert.match(c.avatar, /^\/contributors\/[\w.-]+\.(png|jpg)$/);
      assert.ok(
        existsSync(new URL(`public${c.avatar}`, root)),
        `${c.avatar} is missing`,
      );
    }
  }
});

test("the contributors page renders everyone, with no address but support's", () => {
  const url = new URL("dist/contributors/index.html", root);
  assert.ok(existsSync(url), "dist/contributors/index.html is missing");
  const html = readFileSync(url, "utf8");
  assert.match(html, /<h1[^>]*>Built in the open\.<\/h1>/);
  for (const c of data.contributors) {
    assert.ok(html.includes(`https://github.com/${c.login}"`), c.login);
  }
  for (const address of html.match(emailPattern) ?? []) {
    assert.equal(address, support, `${address} is on the page`);
  }
  assert.ok(!/mock(up)?\b/i.test(html.replace(/<[^>]+>/g, " ")), "no mockup");
});

test("the footer links to the contributors page and GitHub issues", () => {
  const home = readFileSync(new URL("dist/index.html", root), "utf8");
  assert.match(home, /<a href="[^"]*\/contributors\/"[^>]*>Contributors<\/a>/);
  assert.match(
    home,
    /<a href="https:\/\/github\.com\/pesaclarity\/pesaclarity-app\/issues"[^>]*>Report a problem<\/a>/,
  );
});
