import sources from "../../tool/sources.json";
import lock from "../data/sources.lock.json";
import {
  inlineHtml,
  parseChangelog,
  sentenceCase,
  summary,
  tidy,
  type Release,
} from "./changelog.mjs";

/** A product whose changelog the site shows, from tool/sources.json. */
export interface Product {
  id: string;
  label: string;
  repo: string;
  path: string;
}

export const products: readonly Product[] = sources.changes.map((c) => ({
  id: c.product,
  label: c.label,
  repo: c.repo,
  path: c.path,
}));

const files = import.meta.glob<string>("../data/changes/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface ProductRelease extends Release {
  product: Product;
  /** The date from the heading, else from the version's tag. */
  day: string | null;
  /** An id for the release's place on its product's page. */
  anchor: string;
}

const dates: Record<string, string> = lock.dates;

/** Every product's releases, newest first. Unreleased changes come last. */
export function allReleases(): ProductRelease[] {
  const out: ProductRelease[] = [];
  for (const product of products) {
    const text = files[`../data/changes/${product.id}.md`] ?? "";
    for (const r of parseChangelog(text)) {
      out.push({
        ...r,
        product,
        day:
          r.date ??
          (r.version ? dates[`${product.id}@${r.version}`] : null) ??
          null,
        anchor: r.version ? `v${r.version.replaceAll(".", "-")}` : "next",
      });
    }
  }
  const key = (r: ProductRelease) =>
    r.version === null ? "0" : (r.day ?? "1");
  return out.sort((a, b) => key(b).localeCompare(key(a)));
}

export const releasesOf = (id: string) =>
  allReleases()
    .filter((r) => r.product.id === id)
    .sort((a, b) =>
      // Unreleased first on a product's own page.
      a.version === null ? -1 : b.version === null ? 1 : 0,
    );

export const changeCount = (r: Release) =>
  r.groups.reduce((n, g) => n + g.changes.length, 0);

/**
 * A change as HTML: the whole of it, or its first clause. Commit titles
 * (release-please) start lower case and get a capital; hand-written
 * changelogs are kept as written, since names such as rayo are lower case.
 */
export const changeHtml = (text: string, short = false, capital = true) => {
  const plain = short ? summary(text) : tidy(text);
  return inlineHtml(capital ? sentenceCase(plain) : plain);
};

export const sourceUrl = (p: Product) =>
  `https://github.com/pesaclarity/${p.repo}/blob/main/${p.path}`;

/** `17 November 2026`. */
export function formatDay(day: string | null): string | null {
  if (!day) return null;
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
