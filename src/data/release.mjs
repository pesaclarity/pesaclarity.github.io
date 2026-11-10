// The app build the download buttons point to, read from GitHub Releases
// when the site is built. The app's APK workflow rebuilds the site after it
// publishes, so the version shown is the one people download.

const api = "https://api.github.com/repos/pesaclarity/pesaclarity-app/releases";

/** The kinds of change people notice in the app. */
const userFacing = new Set(["feat", "fix"]);

/**
 * A commit title as plain words: `feat: hours logged by day (#172)` is
 * `Hours logged by day`. Null for changes people don't see in the app,
 * such as `ci:`, `build:` and `docs:`.
 * @param {string} title
 * @returns {string | null}
 */
export function plainChange(title) {
  const match = /^\s*([a-z]+)(?:\([^)]*\))?!?:\s*(.+)$/i.exec(
    String(title ?? ""),
  );
  if (!match || !userFacing.has(match[1].toLowerCase())) return null;
  const text = match[2]
    .replace(/\s*\(#\d+\)\s*$/, "")
    .replaceAll("`", "")
    .replace(/[.\s]+$/, "")
    .trim();
  return text ? text[0].toUpperCase() + text.slice(1) : null;
}

/**
 * What's new, from a release body's "## Recent changes" list: the changes
 * people see, newest first, up to [limit].
 * @param {string | null | undefined} body
 * @param {number} [limit]
 * @returns {string[]}
 */
export function recentChanges(body, limit = 10) {
  const lines = String(body ?? "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s*Recent changes\s*$/i.test(l));
  if (start < 0) return [];
  const changes = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    const change = item && plainChange(item[1]);
    if (change && !changes.includes(change)) changes.push(change);
    if (changes.length >= limit) break;
  }
  return changes;
}

/**
 * Each file's size in bytes, by name, from a release's assets.
 * @param {any} release
 * @returns {Record<string, number>}
 */
export function assetSizes(release) {
  const sizes = {};
  for (const a of release?.assets ?? []) {
    if (typeof a?.name === "string" && Number.isFinite(a?.size) && a.size > 0) {
      sizes[a.name] = a.size;
    }
  }
  return sizes;
}

/** `19.4 MB`, in the units phones use (1 MB is 1,000,000 bytes). */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * @typedef {{
 *   version: string,
 *   date: string,
 *   changes: string[],
 *   sizes: Record<string, number>,
 * }} AppRelease
 */

/**
 * The version, date, what's new and file sizes of a GitHub release, or
 * null when it has no APK.
 * @param {any} release the release as the GitHub API returns it
 * @returns {AppRelease | null}
 */
export function describeRelease(release) {
  const apk = (release?.assets ?? []).find(
    (a) => a?.name === "pesaclarity-play.apk",
  );
  if (!apk) return null;
  const name = String(release.name ?? "").trim();
  const tag = String(release.tag_name ?? "").trim();
  // "Test build 0.4.0-dev.12" or tag "v0.4.0".
  const version =
    name.replace(/^Test build\s+/i, "").trim() || tag.replace(/^v/, "");
  if (!version || version === "test-build") return null;
  return {
    version,
    date: apk.updated_at ?? release.published_at,
    changes: recentChanges(release.body),
    sizes: assetSizes(release),
  };
}

/** `3 Nov 2026`, in Nairobi time. */
export function formatDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

/** One read per tag for a whole build, however many pages show it. */
const fetched = new Map();

/**
 * Reads the release for [tag] ("latest", "test-build" or a version tag).
 * A build without network still succeeds: it just shows no version, sizes
 * or changes.
 * @param {string} tag
 * @param {{ token?: string, fetchImpl?: (url: string, init?: RequestInit) => Promise<any> }} [options]
 * @returns {Promise<AppRelease | null>}
 */
export function fetchAppRelease(tag, { token, fetchImpl } = {}) {
  if (fetchImpl) return readRelease(tag, token, fetchImpl);
  if (!fetched.has(tag)) fetched.set(tag, readRelease(tag, token, fetch));
  return fetched.get(tag);
}

async function readRelease(tag, token, fetchImpl) {
  const url = tag === "latest" ? `${api}/latest` : `${api}/tags/${tag}`;
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return describeRelease(await response.json());
  } catch {
    return null;
  }
}
