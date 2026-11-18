import { getCollection, type CollectionEntry } from "astro:content";
import { helpTopics } from "../data/help";
import { withBase } from "./paths";
import type { NavItem } from "../layouts/Article.astro";

export type HelpArticle = CollectionEntry<"help">;

/** A help article's topic and its own name, from its file path. */
export function partsOf(article: HelpArticle) {
  const [topic, slug] = article.id.split("/");
  return { topic, slug };
}

export const articleUrl = (a: HelpArticle) => {
  const { topic, slug } = partsOf(a);
  return withBase(`/help/${topic}/${slug}/`);
};

/** Every help article, by topic, in order. */
export async function helpArticles() {
  const all = await getCollection("help");
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** The help navigation: every topic, with the open topic's articles. */
export function helpNav(
  articles: readonly HelpArticle[],
  openTopic: string,
  current?: string,
): NavItem[] {
  return helpTopics.map((t) => ({
    label: t.title,
    href: withBase(`/help/${t.id}/`),
    current: !current && t.id === openTopic,
    children:
      t.id === openTopic
        ? articles
            .filter((a) => partsOf(a).topic === t.id)
            .map((a) => ({
              label: a.data.title,
              href: articleUrl(a),
              current: a.id === current,
            }))
        : undefined,
  }));
}
