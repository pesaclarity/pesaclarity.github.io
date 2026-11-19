#!/usr/bin/env node
// Counts who has contributed to the project's repositories, for the
// Contributors page. Writes src/data/contributors.json and each person's
// GitHub picture to public/contributors/<login>.<ext>.
//
//   node tool/contributors.mjs
//
// For each repository it reads the commits on the default branch and the
// merged pull requests, by GitHub account. It never reads or keeps an email
// address: commits are counted by the GitHub account GitHub matched them to,
// and commits with no account are left out. Bots are left out too.
//
// The Pages workflow runs this before each build with its GITHUB_TOKEN. If
// GitHub cannot be reached, it changes nothing and exits 0, so the build uses
// the list last committed. Run it by hand and commit the result to refresh
// that list.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "src/data/contributors.json");
const avatarDir = join(root, "public/contributors");

const owner = "pesaclarity";
/** Each repository, with the short name the page shows. */
export const repos = {
  "pesaclarity-app": "app",
  "pesaclarity-backend": "backend",
  "pesaclarity-ml": "ml",
  docs: "docs",
  "pesaclarity.github.io": "website",
  rayo: "rayo",
  "ujumbe-parsers": "ujumbe-parsers",
  ".github": ".github",
};

const botLogins = new Set([
  "dependabot",
  "dependabot-preview",
  "release-please",
  "release-please-bot",
  "github-actions",
  "renovate",
  "renovate-bot",
  "web-flow",
  // Coding agents that commit under an account of type User.
  "claude",
  "copilot",
  "copilot-swe-agent",
  "googlebot",
]);

/** True for bot accounts: GitHub's Bot type, `[bot]` logins and known bots. */
export function isBot(user) {
  if (!user?.login) return true;
  const login = String(user.login).toLowerCase();
  return (
    user.type === "Bot" ||
    login.endsWith("[bot]") ||
    login.endsWith("-bot") ||
    botLogins.has(login)
  );
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "pesaclarity-site-contributors",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res.json();
}

/** Every page of a list endpoint. */
async function all(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const items = await api(`${path}${sep}per_page=100&page=${page}`);
    out.push(...items);
    if (items.length < 100) return out;
  }
}

const day = (iso) => String(iso).slice(0, 10);

/** Bot logins left out, for the log. */
const leftOut = new Map();
function skip(user) {
  if (!isBot(user)) return false;
  const login = user?.login ?? "(no GitHub account)";
  leftOut.set(login, (leftOut.get(login) ?? 0) + 1);
  return true;
}

async function collect() {
  /** @type {Map<string, any>} */
  const people = new Map();
  const person = (user) => {
    let p = people.get(user.login);
    if (!p) {
      p = {
        login: user.login,
        id: user.id,
        commits: 0,
        prs: 0,
        repos: new Set(),
        first: null,
        latest: null,
      };
      people.set(user.login, p);
    }
    return p;
  };
  const seen = (p, repo, when) => {
    p.repos.add(repo);
    const d = day(when);
    if (!p.first || d < p.first) p.first = d;
    if (!p.latest || d > p.latest) p.latest = d;
  };

  for (const [name, short] of Object.entries(repos)) {
    const info = await api(`/repos/${owner}/${name}`);
    const commits = await all(
      `/repos/${owner}/${name}/commits?sha=${encodeURIComponent(info.default_branch)}`,
    );
    for (const c of commits) {
      // c.author is the GitHub account; c.commit.author holds the email,
      // which is only ever read for its date.
      if (skip(c.author)) continue;
      const p = person(c.author);
      p.commits++;
      seen(p, short, c.commit.author.date);
    }
    const pulls = await all(`/repos/${owner}/${name}/pulls?state=closed`);
    for (const pr of pulls) {
      if (!pr.merged_at || skip(pr.user)) continue;
      const p = person(pr.user);
      p.prs++;
      seen(p, short, pr.merged_at);
    }
  }

  const list = [];
  for (const p of people.values()) {
    // The profile adds a display name. Without it the page shows the login.
    let user = {};
    try {
      user = await api(`/users/${encodeURIComponent(p.login)}`);
    } catch {
      // Keep the login only.
    }
    if (user.type && isBot(user)) continue;
    list.push({
      login: p.login,
      // The public profile name only; never the email.
      name:
        typeof user.name === "string" && user.name.trim()
          ? user.name.trim()
          : null,
      id: p.id,
      commits: p.commits,
      prs: p.prs,
      repos: Object.values(repos).filter((r) => p.repos.has(r)),
      first: p.first,
      latest: p.latest,
      avatar: null,
    });
  }
  list.sort(
    (a, b) =>
      b.commits - a.commits || b.prs - a.prs || a.login.localeCompare(b.login),
  );
  return list;
}

/** Downloads each picture at 96 px. A failed one falls back to initials. */
async function avatars(list) {
  mkdirSync(avatarDir, { recursive: true });
  const keep = new Set();
  for (const p of list) {
    try {
      const res = await fetch(
        `https://avatars.githubusercontent.com/u/${p.id}?s=96&v=4`,
        { headers: { "User-Agent": headers["User-Agent"] } },
      );
      const type = res.headers.get("content-type") ?? "";
      const ext = type.includes("png")
        ? "png"
        : type.includes("jpeg")
          ? "jpg"
          : null;
      if (!res.ok || !ext) continue;
      const file = `${p.login.toLowerCase()}.${ext}`;
      writeFileSync(
        join(avatarDir, file),
        Buffer.from(await res.arrayBuffer()),
      );
      p.avatar = `/contributors/${file}`;
      keep.add(file);
    } catch {
      // Initials instead.
    }
  }
  for (const f of readdirSync(avatarDir)) {
    if (!keep.has(f)) rmSync(join(avatarDir, f));
  }
}

// Run only as a script, so the tests can import isBot.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const list = await collect();
    await avatars(list);
    const data = {
      counted: new Date().toISOString().slice(0, 10),
      repos: Object.values(repos),
      contributors: list.map(({ id, ...rest }) => rest),
    };
    writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
    console.log(
      `contributors: ${list.length} people across ${data.repos.length} repositories`,
    );
    console.log(
      `contributors: left out ${[...leftOut].map(([l, n]) => `${l} (${n})`).join(", ") || "nobody"}`,
    );
  } catch (err) {
    console.warn(
      `contributors: GitHub could not be read (${err.message}); keeping the last committed list`,
    );
  }
}
