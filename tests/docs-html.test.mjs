// The docs' HTML enhancements (src/lib/docs-html.mjs): tabs, framed code
// blocks, callouts and heading links. Needs no build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { enhanceDocHtml, languageName } from "../src/lib/docs-html.mjs";

const pre = (lang, code) =>
  `<pre class="astro-code pesaclarity" tabindex="0" data-language="${lang}"><code><span class="line">${code}</span></code></pre>`;

test("a code block gets a header with its language and a hidden copy button", () => {
  const html = enhanceDocHtml(`<p>Run:</p>\n${pre("sh", "make")}`);
  assert.match(
    html,
    /<div class="code-block"><div class="code-head"><span class="code-lang">Terminal<\/span><button type="button" class="code-copy" data-copy hidden>Copy<\/button><\/div><pre /,
  );
  assert.equal(languageName("dart"), "Dart");
  assert.equal(languageName("zig"), "ZIG");
});

test("<!-- tabs --> puts the code blocks after it in tabs, named by language", () => {
  const html = enhanceDocHtml(
    `<!-- tabs -->\n${pre("c", "int x;")}\n${pre("dart", "var x;")}\n${pre("python", "x = 1")}\n<p>After</p>`,
  );
  assert.equal(html.match(/role="tab"/g)?.length, 3);
  assert.equal(html.match(/role="tabpanel"/g)?.length, 3);
  assert.match(
    html,
    /<div class="code-tablist" role="tablist" aria-label="Code examples" hidden>/,
  );
  assert.match(html, /aria-selected="true" tabindex="0" data-tab="c">C</);
  assert.match(
    html,
    /aria-selected="false" tabindex="-1" data-tab="dart">Dart</,
  );
  assert.match(html, /data-tab="python">Python</);
  // Each panel's block is framed, under the tab's name.
  assert.match(
    html,
    /data-label="Dart"><div class="code-block"><div class="code-head"><span class="code-lang">Dart</,
  );
  assert.match(html, /<p>After<\/p>$/);
  assert.doesNotMatch(html, /<!-- tabs -->/);
});

test("<!-- tabs: A | B --> names the tabs", () => {
  const html = enhanceDocHtml(
    `<!-- tabs: pub.dev | Git -->\n${pre("yaml", "a")}\n${pre("yaml", "b")}`,
  );
  assert.match(html, /data-tab="pub-dev">pub\.dev</);
  assert.match(html, /data-tab="git">Git</);
  assert.match(html, /<span class="code-lang">pub\.dev</);
});

test("tabs of one name, or a single block, stay as they are", () => {
  const same = enhanceDocHtml(
    `<!-- tabs -->\n${pre("yaml", "a")}\n${pre("yaml", "b")}`,
  );
  assert.doesNotMatch(same, /role="tab"/);
  const one = enhanceDocHtml(`<!-- tabs -->\n${pre("c", "a")}\n<p>x</p>`);
  assert.doesNotMatch(one, /role="tab"/);
});

test("two sets of tabs get their own ids", () => {
  const html = enhanceDocHtml(
    `<!-- tabs -->${pre("c", "a")}${pre("dart", "b")}<p>x</p><!-- tabs -->${pre("c", "a")}${pre("dart", "b")}`,
  );
  assert.match(html, /id="tabs-1-tab-0"/);
  assert.match(html, /id="tabs-2-tab-0"/);
});

test("GitHub's alerts become callouts", () => {
  const html = enhanceDocHtml(
    "<blockquote>\n<p>[!WARNING]\nThe exception is a <strong>draft</strong>.</p>\n</blockquote>\n<blockquote>\n<p>Just a quote.</p>\n</blockquote>",
  );
  assert.match(
    html,
    /<div class="callout callout-warning" role="note" aria-label="Warning"><p class="callout-title">Warning<\/p><p>The exception is a <strong>draft<\/strong>\.<\/p>\n<\/div>/,
  );
  assert.match(html, /<blockquote>\n<p>Just a quote\.<\/p>/);
  for (const kind of ["NOTE", "TIP", "IMPORTANT", "CAUTION"]) {
    assert.match(
      enhanceDocHtml(`<blockquote>\n<p>[!${kind}]\nx</p>\n</blockquote>`),
      new RegExp(`callout-${kind.toLowerCase()}`),
    );
  }
});

test("headings get a link to themselves, with no text of their own", () => {
  const html = enhanceDocHtml(
    '<h3 id="rayo_model_load"><code>rayo_model_load</code></h3>',
  );
  assert.equal(
    html,
    '<h3 id="rayo_model_load"><code>rayo_model_load</code><a class="heading-anchor" href="#rayo_model_load" aria-label="Link to rayo_model_load"></a></h3>',
  );
});

test("adds no script and no style attribute", () => {
  const html = enhanceDocHtml(
    `<!-- tabs -->${pre("c", "a")}${pre("dart", "b")}<h2 id="x">X</h2><blockquote><p>[!TIP]\ny</p></blockquote>`,
  );
  assert.doesNotMatch(html, /<script|\sstyle="|\son[a-z]+=/i);
});
