// Reads a CHANGELOG.md, as release-please writes them or by hand, into
// releases: version, date, and groups of changes. Plain JavaScript so the
// tests can import it.

/**
 * @typedef {{ text: string, children: string[] }} Change
 * @typedef {{ title: string, changes: Change[] }} Group
 * @typedef {{ version: string | null, date: string | null, compare: string | null, groups: Group[] }} Release
 */

/**
 * @param {string} markdown
 * @returns {Release[]} newest first, as the file lists them
 */
export function parseChangelog(markdown) {
  /** @type {Release[]} */
  const releases = [];
  /** @type {Release | null} */
  let release = null;
  /** @type {Group | null} */
  let group = null;
  /** @type {Change | null} */
  let change = null;

  for (const line of String(markdown).split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const head = h2[1];
      const link =
        /^\[v?([^\]]+)\]\(([^)]+)\)\s*(?:\((\d{4}-\d{2}-\d{2})\))?/.exec(head);
      const plain = /^v?(\d+\.\d+\.\d+)\s*(?:\((\d{4}-\d{2}-\d{2})\))?/.exec(
        head,
      );
      release = {
        version: link?.[1] ?? plain?.[1] ?? null,
        date: link?.[3] ?? plain?.[2] ?? null,
        compare: link?.[2] ?? null,
        groups: [],
      };
      releases.push(release);
      group = null;
      change = null;
      continue;
    }
    if (!release) continue;
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      group = { title: h3[1], changes: [] };
      release.groups.push(group);
      change = null;
      continue;
    }
    const item = /^([-*])\s+(.*)$/.exec(line);
    const sub = /^\s{2,}[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (!group) {
        group = { title: "", changes: [] };
        release.groups.push(group);
      }
      change = { text: item[2], children: [] };
      group.changes.push(change);
    } else if (sub && change) {
      change.children.push(sub[1]);
    } else if (/^\s+\S/.test(line) && change) {
      // A wrapped line belongs to the last item or sub-item.
      const text = line.trim();
      if (change.children.length) {
        change.children[change.children.length - 1] += ` ${text}`;
      } else {
        change.text += ` ${text}`;
      }
    } else if (line.trim() === "") {
      // Blank lines end nothing: hand-written lists put them between items.
    }
  }
  return releases.filter((r) => r.groups.some((g) => g.changes.length));
}

/** Drops the commit-hash links release-please adds after each change. */
export function tidy(text) {
  return String(text)
    .replace(/\s*\(\[[0-9a-f]{7,40}\]\([^)]*\/commit\/[0-9a-f]+\)\)/g, "")
    .replace(/\((\[#\d+\]\([^)\s]+\))\)/g, "$1")
    .trim();
}

/** Starts a change with a capital, as the site writes them. */
export function sentenceCase(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** A change's first clause, for the short view. */
export function summary(text) {
  const plain = tidy(text);
  const colon = plain.indexOf(": ");
  if (colon > 3 && colon < 120) return plain.slice(0, colon);
  if (/:$/.test(plain)) return plain.slice(0, -1);
  const stop = plain.search(/\.\s/);
  if (stop > 20 && stop < 160) return plain.slice(0, stop);
  return plain;
}

const escapeHtml = (s) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/**
 * The inline Markdown changelogs use (code, bold, links) as HTML. Issue
 * links such as [#234](…) stay links; everything else is escaped.
 * @param {string} text
 */
export function inlineHtml(text) {
  const parts = [];
  let rest = String(text);
  const pattern =
    /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;
  while (rest) {
    const m = pattern.exec(rest);
    if (!m) {
      parts.push(escapeHtml(rest));
      break;
    }
    parts.push(escapeHtml(rest.slice(0, m.index)));
    if (m[1] !== undefined) parts.push(`<code>${escapeHtml(m[1])}</code>`);
    else if (m[2] !== undefined)
      parts.push(`<strong>${inlineHtml(m[2])}</strong>`);
    else parts.push(`<a href="${escapeHtml(m[4])}">${escapeHtml(m[3])}</a>`);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts.join("");
}
