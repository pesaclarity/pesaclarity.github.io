import { withBase } from "./paths";

/** Markdown's HTML with site-root links and images under the base path. */
export function withBaseHtml(html: string): string {
  return html.replace(
    /\s(href|src)="\/(?!\/)([^"]*)"/g,
    (_, attr, rest) => ` ${attr}="${withBase(`/${rest}`)}"`,
  );
}

/** Second-level headings, for "On this page". */
export function tocOf(
  headings: readonly { depth: number; slug: string; text: string }[] = [],
) {
  return headings.filter((h) => h.depth === 2);
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
