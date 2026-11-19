import { withBase } from "./paths";

/** Markdown's HTML with site-root links and images under the base path. */
export function withBaseHtml(html: string): string {
  return html.replace(
    /\s(href|src)="\/(?!\/)([^"]*)"/g,
    (_, attr, rest) => ` ${attr}="${withBase(`/${rest}`)}"`,
  );
}

export interface TocItem {
  slug: string;
  text: string;
  /** Third-level headings under it, when asked for. */
  children?: TocItem[];
}

/**
 * Second-level headings, for "On this page"; with `depth` 3, each with the
 * third-level headings under it (an API reference's functions).
 */
export function tocOf(
  headings: readonly { depth: number; slug: string; text: string }[] = [],
  depth: 2 | 3 = 2,
): TocItem[] {
  const out: TocItem[] = [];
  for (const h of headings) {
    if (h.depth === 2) out.push({ slug: h.slug, text: h.text });
    else if (h.depth === 3 && depth === 3 && out.length) {
      (out[out.length - 1].children ??= []).push({
        slug: h.slug,
        text: h.text,
      });
    }
  }
  return out;
}

/** About how long a page takes to read, at 200 words a minute. */
export function minutesToRead(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** `18 November 2026`. */
export function longDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
