#!/usr/bin/env node
// Copies the developer docs and the changelogs from the project's other
// repositories into this one, so the site builds from files in its own
// checkout, with no network.
//
//   node tool/sync-sources.mjs            fetch at the pinned commits again
//   node tool/sync-sources.mjs --update   move each pin to the newest commit
//                                         of its branch, then fetch
//   node tool/sync-sources.mjs --update rayo,docs
//                                         move only those repositories' pins
//   node tool/sync-sources.mjs --pin rayo=COMMIT
//                                         pin a repository to one commit, such
//                                         as a pull request's, to preview it
//
// What is copied is listed in tool/sources.json. The pins, and a SHA-256 of
// every file written, are in src/data/sources.lock.json. Docs land in
// src/content/docs/<section>/<slug>.md with front matter saying where they
// came from; changelogs in src/data/changes/<product>.md.
//
// Each file is read from raw.githubusercontent.com at its commit, so a pin
// always gives the same bytes. Relative links are pointed at the copied page
// when there is one, else at the file on GitHub at that commit. Images are
// turned into links, since the site loads nothing from other servers.
//
// Set GITHUB_TOKEN to raise the GitHub API's rate limit (only --update and
// release dates use the API).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  readFileSync(join(root, "tool/sources.json"), "utf8"),
);
const lockPath = join(root, "src/data/sources.lock.json");
const docsDir = join(root, "src/content/docs");
const changesDir = join(root, "src/data/changes");
const args = process.argv.slice(2);
const optionValue = (name) => {
  const i = args.indexOf(name);
  const next = args[i + 1];
  return i >= 0 && next && !next.startsWith("--") ? next : undefined;
};
const update = args.includes("--update");
// --update REPO,REPO: only those; --update alone: every repository.
const updateOnly = optionValue("--update")?.split(",");
const pins = Object.fromEntries(
  (optionValue("--pin") ?? "")
    .split(",")
    .filter(Boolean)
    .map((p) => p.split("=")),
);
for (const [repo, commit] of Object.entries(pins)) {
  if (!config.repos[repo] || !/^[0-9a-f]{40}$/.test(commit ?? "")) {
    throw new Error(`--pin ${repo}=${commit}: a repository and a full commit`);
  }
}
for (const repo of updateOnly ?? []) {
  if (!config.repos[repo])
    throw new Error(`--update ${repo}: no such repository`);
}

let lock = { repos: {} };
try {
  lock = JSON.parse(readFileSync(lockPath, "utf8"));
} catch {
  // First run: every repository is resolved from its branch.
}

const headers = { "User-Agent": "pesaclarity-site-sync" };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function get(url, accept) {
  // The token is for the API only; raw files are public.
  const sent = url.startsWith("https://api.github.com/")
    ? headers
    : { "User-Agent": headers["User-Agent"] };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      headers: accept ? { ...sent, Accept: accept } : sent,
    });
    if (res.ok) return res.text();
    if (res.status === 404 || attempt === 4) {
      throw new Error(`${res.status} ${res.statusText}: ${url}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

const api = (path) => `https://api.github.com/repos/${config.owner}/${path}`;

async function resolveCommit(repo) {
  const sha = await get(
    api(`${repo}/commits/${config.repos[repo].ref}`),
    "application/vnd.github.sha",
  );
  return sha.trim();
}

const blob = (repo, commit, path) =>
  `https://github.com/${config.owner}/${repo}/blob/${commit}/${path}`;
const raw = (repo, commit, path) =>
  `https://raw.githubusercontent.com/${config.owner}/${repo}/${commit}/${path}`;

// --- Markdown helpers -----------------------------------------------------

/** Splits text into code fences and the rest, so edits skip the code. */
function mapOutsideCode(text, fn) {
  const parts = text.split(
    /(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?^ {0,3}(?:```|~~~)[ \t]*$)/m,
  );
  return parts.map((part, i) => (i % 2 === 1 ? part : fn(part))).join("");
}

/** Headings outside code, with their level, text and line index. */
function headings(lines) {
  const found = [];
  let fence = null;
  lines.forEach((line, i) => {
    const f = line.match(/^ {0,3}(```|~~~)/);
    if (f) {
      if (!fence) fence = f[1];
      else if (line.trim().startsWith(fence)) fence = null;
      return;
    }
    if (fence) return;
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) found.push({ level: h[1].length, text: h[2], line: i });
  });
  return found;
}

/** The section under heading `title`, without its heading, or the file
 * without the sections named in `omit`. */
function select(text, { only, omit }) {
  const lines = text.split("\n");
  const hs = headings(lines);
  const sectionEnd = (h) =>
    hs.find((n) => n.line > h.line && n.level <= h.level)?.line ?? lines.length;
  if (only) {
    const h = hs.find((x) => x.text === only);
    if (!h) throw new Error(`no heading "${only}"`);
    const body = lines.slice(h.line + 1, sectionEnd(h));
    // Lift the section's own subheadings by the levels it lost.
    const lift = h.level - 1;
    return mapOutsideCode(body.join("\n"), (part) =>
      part.replace(
        /^(#{2,6})(\s)/gm,
        (_, hashes, space) =>
          `${"#".repeat(Math.max(2, hashes.length - lift))}${space}`,
      ),
    );
  }
  let keep = lines.map(() => true);
  for (const title of omit ?? []) {
    const h = hs.find((x) => x.text === title);
    if (!h) throw new Error(`no heading "${title}"`);
    for (let i = h.line; i < sectionEnd(h); i++) keep[i] = false;
  }
  return lines.filter((_, i) => keep[i]).join("\n");
}

/** Removes the first-level title; the page has its own. */
function dropTitle(text) {
  return text.replace(/^\s*#\s+[^\n]*\n/, "");
}

/** The first paragraph as plain text, for the page's description. */
function firstParagraph(text) {
  const para = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|```|~~~|\||-|\*|>|<|\d+\.|!?\[!)/.test(p));
  if (!para) return "";
  const plain = para
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 220) return plain;
  const cut = plain.slice(0, 220);
  const stop = cut.lastIndexOf(". ");
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.replace(/\s\S*$/, "")}…`;
}

/** Points links at the copied page or at GitHub, and turns images into
 * links, so nothing loads from another server. */
function rewriteLinks(text, { repo, commit, path, pages }) {
  const here = posix.dirname(path);
  const target = (href) => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const [file, hash] = href.split("#");
    const resolved = posix
      .normalize(posix.join(here, file))
      .replace(/^\/+/, "");
    const page = pages.get(`${repo}:${resolved}`);
    if (page && !page.partial) return `${page.url}${hash ? `#${hash}` : ""}`;
    return `${blob(repo, commit, resolved)}${hash ? `#${hash}` : ""}`;
  };
  return mapOutsideCode(text, (part) =>
    part
      // Badges: an image inside a link. Dropped; they only decorate.
      .replace(/^\s*(\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*)+\n/gm, "")
      // <picture> and <img>: kept as a link to the image.
      .replace(/<picture>[\s\S]*?<\/picture>/g, (html) => imgLink(html))
      .replace(/<img\b[^>]*>/g, (html) => imgLink(html))
      // Markdown images.
      .replace(
        /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g,
        (_, alt, src) => `[${alt || "Image"} (image)](${target(src)})`,
      )
      // Links, inline and reference-style definitions.
      .replace(
        /(?<!!)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
        (_, label, href, title) => `[${label}](${target(href)}${title ?? ""})`,
      )
      .replace(
        /^(\s*\[[^\]]+\]:\s*)(\S+)/gm,
        (_, lead, href) => `${lead}${target(href)}`,
      ),
  );

  function imgLink(html) {
    const img = html.match(/<img\b[^>]*>/)?.[0] ?? html;
    const alt = img.match(/\balt="([^"]*)"/)?.[1] ?? "Image";
    const src = img.match(/\bsrc="([^"]*)"/)?.[1];
    return src ? `[${alt} (image)](${target(src)})` : "";
  }
}

/** The ids the site's Markdown gives headings (GitHub's rule). */
function anchorsOf(text) {
  const ids = new Set();
  const seen = new Map();
  for (const h of headings(text.split("\n"))) {
    const plain = h.text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_]/g, "");
    let id = plain
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
      .replace(/ /g, "-");
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    ids.add(id);
  }
  return ids;
}

function yamlString(value) {
  return JSON.stringify(value);
}

// --- Run ------------------------------------------------------------------

const commits = {};
for (const repo of Object.keys(config.repos)) {
  const pinned = lock.repos[repo]?.commit;
  const move = update && (!updateOnly || updateOnly.includes(repo));
  commits[repo] =
    pins[repo] ?? (move || !pinned ? await resolveCommit(repo) : pinned);
}

// Every copied page, by repository and path, so links between them stay
// on the site. A page made from one section of a file does not stand for
// the whole file.
const pages = new Map();
for (const d of config.docs) {
  const key = `${d.repo}:${d.path}`;
  if (!d.only && !pages.has(key)) {
    pages.set(key, { url: `/docs/${d.section}/${d.slug}/`, partial: false });
  }
}

const files = {};
const sources = new Map();
async function source(repo, path) {
  const key = `${repo}:${path}`;
  if (!sources.has(key)) {
    sources.set(key, await get(raw(repo, commits[repo], path)));
  }
  return sources.get(key);
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  files[file.slice(root.length + 1)] = createHash("sha256")
    .update(text)
    .digest("hex");
}

rmSync(docsDir, { recursive: true, force: true });
rmSync(changesDir, { recursive: true, force: true });

// Pass 1: each page's text, and the anchors its headings get.
const built = [];
for (const d of config.docs) {
  const commit = commits[d.repo];
  let body = await source(d.repo, d.path);
  body = d.only || d.omit ? select(body, d) : body;
  body = dropTitle(body);
  body = rewriteLinks(body, { ...d, commit, pages });
  built.push({ d, commit, body, anchors: anchorsOf(body) });
}

// Pass 2: a link to an anchor that moved to another page made from the
// same file goes there; one found on no page goes to GitHub.
for (const page of built) {
  const { d, commit } = page;
  const resolve = (anchor) => {
    if (page.anchors.has(anchor)) return `#${anchor}`;
    const other = built.find(
      (p) =>
        p.d.repo === d.repo && p.d.path === d.path && p.anchors.has(anchor),
    );
    if (other) return `/docs/${other.d.section}/${other.d.slug}/#${anchor}`;
    return `${blob(d.repo, commit, d.path)}#${anchor}`;
  };
  page.body = mapOutsideCode(page.body, (part) =>
    part.replace(/\]\(#([^)\s]+)\)/g, (_, anchor) => `](${resolve(anchor)})`),
  );
}

for (const [order, { d, commit, body }] of built.entries()) {
  const front = [
    "---",
    `title: ${yamlString(d.title)}`,
    `description: ${yamlString(firstParagraph(body))}`,
    `section: ${yamlString(d.section)}`,
    `order: ${order}`,
    `repo: ${yamlString(d.repo)}`,
    `path: ${yamlString(d.path)}`,
    `commit: ${yamlString(commit)}`,
    `source: ${yamlString(blob(d.repo, commit, d.path))}`,
    `edit: ${yamlString(`https://github.com/${config.owner}/${d.repo}/edit/${config.repos[d.repo].ref}/${d.path}`)}`,
    "---",
    "",
  ].join("\n");
  write(join(docsDir, d.section, `${d.slug}.md`), `${front}${body.trim()}\n`);
}

// Changelogs, with the release date of any version whose heading has none,
// from its tag.
const dates = Object.fromEntries(
  Object.entries(config.dates ?? {}).filter(([k]) => !k.startsWith("$")),
);
for (const c of config.changes) {
  let text = await source(c.repo, c.path);
  for (const [from, to] of config.rewrite[c.product] ?? []) {
    if (!text.includes(from)) {
      throw new Error(`${c.repo}/${c.path}: rewrite text not found: ${from}`);
    }
    text = text.replaceAll(from, to);
  }
  write(join(changesDir, `${c.product}.md`), text);
  for (const [, version] of text.matchAll(
    /^## \[?v?(\d+\.\d+\.\d+)\]?(?:\([^)]*\))?\s*$/gm,
  )) {
    if (dates[`${c.product}@${version}`]) continue;
    try {
      const json = JSON.parse(await get(api(`${c.repo}/commits/v${version}`)));
      dates[`${c.product}@${version}`] = json.commit.committer.date.slice(
        0,
        10,
      );
    } catch {
      // No tag for this version: it shows with no date.
    }
  }
}

const out = {
  $comment:
    "Written by tool/sync-sources.mjs. The commit each repository was copied from, and a SHA-256 of every file written.",
  repos: Object.fromEntries(
    Object.entries(commits).map(([repo, commit]) => [
      repo,
      { ref: config.repos[repo].ref, commit },
    ]),
  ),
  dates,
  files,
};
mkdirSync(dirname(lockPath), { recursive: true });
writeFileSync(lockPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `Copied ${Object.keys(files).length} files from ${Object.keys(commits).length} repositories.`,
);
