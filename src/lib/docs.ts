import { getCollection, type CollectionEntry } from "astro:content";
import { docSections } from "../data/docs";
import { withBase } from "./paths";
import type { NavItem } from "../layouts/Article.astro";

export type DocPage = CollectionEntry<"docs">;

export const slugOf = (page: DocPage) => page.id.split("/")[1];
export const docUrl = (page: DocPage) =>
  withBase(`/docs/${page.data.section}/${slugOf(page)}/`);

/** Every docs page, in the order tool/sources.json lists them. */
export async function docPages() {
  const all = await getCollection("docs");
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** The docs navigation: every section, with the open section's pages. */
export function docsNav(
  pages: readonly DocPage[],
  openSection: string,
  current?: string,
): NavItem[] {
  return docSections.map((s) => ({
    label: s.short ?? s.title,
    href: withBase(`/docs/${s.id}/`),
    current: !current && s.id === openSection,
    children:
      s.id === openSection
        ? pages
            .filter((p) => p.data.section === s.id)
            .map((p) => ({
              label: p.data.title,
              href: docUrl(p),
              current: p.id === current,
            }))
        : undefined,
  }));
}

/** `ujumbe-parsers/docs/RELEASING.md`. */
export const sourceName = (page: DocPage) =>
  `${page.data.repo}/${page.data.path}`;
