import { existsSync } from "node:fs";
import { join } from "node:path";

/*
 * App screens come in a light version, public/screens/<name>.webp, and may
 * have a dark one next to it, <name>-dark.webp. Where the dark one exists the
 * page carries both images and global.css shows the one that matches the
 * theme (the same rules as tokens.css), so a manual theme choice wins. The
 * hidden image is display: none, so it is out of the accessibility tree and,
 * being lazy, never fetched.
 */

/** The dark screen's name for a light screen, or undefined if it has none. */
export function darkScreen(file: string): string | undefined {
  const dark = `${file}-dark`;
  return existsSync(join(process.cwd(), "public", "screens", `${dark}.webp`))
    ? dark
    : undefined;
}
