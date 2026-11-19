// The developer docs' HTML, made richer when the site is built: code blocks
// with a header and a copy button, code examples in tabs, GitHub-style
// callouts, and a link on every heading. Plain JavaScript, so the unit tests
// (tests/docs-html.test.mjs) import it with no build.
//
// It works on the HTML Astro renders from the synced Markdown, so the docs
// stay plain Markdown in their repositories, readable on GitHub as they are:
//
//   <!-- tabs: C | Dart | Python -->   before two or more code blocks in a row
//                                      puts them in tabs; plain <!-- tabs -->
//                                      names each tab by its language.
//   > [!NOTE]                          (TIP, IMPORTANT, WARNING, CAUTION)
//   > The text.                        a callout, as GitHub shows it.
//
// Nothing here adds a script or a style attribute: the copy buttons and tab
// lists are `hidden` until src/scripts/docs.ts, a file of this site, shows
// them. Without scripts every code block shows, each under its name.

const LANGUAGES = {
  c: "C",
  h: "C",
  cpp: "C++",
  dart: "Dart",
  python: "Python",
  py: "Python",
  sh: "Terminal",
  bash: "Terminal",
  shell: "Terminal",
  console: "Terminal",
  yaml: "YAML",
  yml: "YAML",
  json: "JSON",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  kotlin: "Kotlin",
  swift: "Swift",
  toml: "TOML",
  bat: "Batch",
  powershell: "PowerShell",
  diff: "Diff",
  plaintext: "Text",
  text: "Text",
  txt: "Text",
};

const CALLOUTS = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
};

const PRE = /<pre\b[^>]*>[\s\S]*?<\/pre>/g;

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/** The text of some HTML, entities decoded, for labels. */
const plainText = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/** A code block's language, from Shiki's data-language or the code's class. */
export function languageOf(pre) {
  const lang =
    pre.match(/\sdata-language="([^"]+)"/)?.[1] ??
    pre.match(/class="language-([^"\s]+)/)?.[1] ??
    "";
  return lang.toLowerCase();
}

/** What a language is called on a tab or a code block's header. */
export function languageName(lang) {
  return LANGUAGES[lang] ?? (lang ? lang.toUpperCase() : "Code");
}

const slugOf = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "tab";

/** Runs of code blocks after <!-- tabs --> become one set of tabs. */
function tabs(html, prefix) {
  let group = 0;
  return html.replace(
    /<!--\s*tabs(?::([^>]*?))?\s*-->\s*((?:<pre\b[^>]*>[\s\S]*?<\/pre>\s*){2,})/g,
    (whole, names, run) => {
      const blocks = run.match(PRE);
      const given = (names ?? "")
        .split("|")
        .map((n) => n.trim())
        .filter(Boolean);
      const labels = blocks.map(
        (b, i) => given[i] ?? languageName(languageOf(b)),
      );
      // Two tabs of one name would be one choice: keep the HTML as it was.
      if (new Set(labels).size !== labels.length) return whole;
      const id = `${prefix}tabs-${++group}`;
      const tablist = labels
        .map(
          (label, i) =>
            `<button type="button" role="tab" id="${id}-tab-${i}" aria-controls="${id}-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${slugOf(label)}">${escapeHtml(label)}</button>`,
        )
        .join("");
      const panels = blocks
        .map(
          (b, i) =>
            `<div class="code-panel" role="tabpanel" id="${id}-panel-${i}" aria-labelledby="${id}-tab-${i}" data-tab="${slugOf(labels[i])}" data-label="${escapeHtml(labels[i])}">${b}</div>`,
        )
        .join("");
      return `<div class="code-tabs" data-tabs><div class="code-tablist" role="tablist" aria-label="Code examples" hidden>${tablist}</div>${panels}</div>\n`;
    },
  );
}

/** Each code block in a frame with its language and a copy button. */
function codeBlocks(html) {
  return html.replace(PRE, (pre, at, all) => {
    // A panel names its block on its tab: the header shows that name.
    const panel = all
      .slice(Math.max(0, at - 400), at)
      .match(/data-label="([^"]*)">$/);
    const name = panel ? panel[1] : escapeHtml(languageName(languageOf(pre)));
    return `<div class="code-block"><div class="code-head"><span class="code-lang">${name}</span><button type="button" class="code-copy" data-copy hidden>Copy</button></div>${pre}</div>`;
  });
}

/** GitHub's > [!NOTE] blockquotes as callouts. */
function callouts(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<\/p>\s*<p>)?([\s\S]*?)<\/blockquote>/g,
    (_, kind, rest) => {
      const title = CALLOUTS[kind];
      const body = `<p>${rest}`.replace(/<p>\s*<\/p>/g, "");
      return `<div class="callout callout-${kind.toLowerCase()}" role="note" aria-label="${title}"><p class="callout-title">${title}</p>${body}</div>`;
    },
  );
}

/** A link to each heading's own anchor, for sharing a section. */
function headingLinks(html) {
  return html.replace(
    /<h([2-4]) id="([^"]+)"([^>]*)>([\s\S]*?)<\/h\1>/g,
    (_, level, id, attrs, inner) =>
      `<h${level} id="${id}"${attrs}>${inner}<a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(plainText(inner))}"></a></h${level}>`,
  );
}

/**
 * The docs' HTML with tabs, framed code blocks, callouts and heading links.
 * `prefix` keeps the tabs' ids unique if two documents share a page.
 */
export function enhanceDocHtml(html, { prefix = "" } = {}) {
  return headingLinks(callouts(codeBlocks(tabs(String(html), prefix))));
}
