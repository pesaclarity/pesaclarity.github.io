import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * Developer docs, copied from each repository by tool/sync-sources.mjs.
 * Do not edit them here: change them in their own repository.
 */
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.string(),
    order: z.number(),
    repo: z.string(),
    path: z.string(),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    source: z.url(),
    edit: z.url(),
  }),
});

/** Help articles, written for this site from the app's own screens. */
const help = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/help" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    updated: z.coerce.date(),
    /** An app screen to show after the first steps, by its key in site.ts. */
    screen: z.string().optional(),
    screenCaption: z.string().optional(),
  }),
});

export const collections = { docs, help };
