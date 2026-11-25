// Pulls a statement PDF's characters out with pdf.js, in the shape the app
// gets them from PDFium: per page, the text and one box per character in
// PDF coordinates (origin bottom-left, y up). The engine then groups them
// into words with the app's own pageFromCharacters.
//
// pdf.js gives runs of text, not characters. Each run is split into its
// characters, each as wide as the font says (glyph widths from the run's
// font, else an equal share of the run), and as tall as its ink
// (inkHeight), as PDFium's boxes are.
//
// Runs in the Web Worker (worker.mjs) and in Node (the golden tests).

export class PasswordRequired extends Error {}
export class WrongPassword extends Error {}
export class Unreadable extends Error {}

// pdfjs: the pdf.js module. bytes: Uint8Array (pdf.js takes it over).
export async function extractPages(pdfjs, bytes, password) {
  let doc;
  const task = pdfjs.getDocument({
    data: bytes,
    password: password ?? undefined,
    // Nothing beyond the file itself: no fonts, maps or scripts fetched.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    stopAtErrors: false,
    verbosity: 0,
    // Keeps each font's glyph widths where glyphWidths reads them.
    fontExtraProperties: true,
  });
  try {
    doc = await task.promise;
  } catch (e) {
    await task.destroy();
    if (e?.name === "PasswordException") {
      throw e.code === 2 ? new WrongPassword() : new PasswordRequired();
    }
    throw new Unreadable(String(e?.message ?? e));
  }
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [x0, y0, , y1] = page.view;
      // Loads the page's fonts (into page.commonObjs), for their widths.
      await page.getOperatorList();
      const content = await page.getTextContent({ disableNormalization: true });
      let text = "";
      const boxes = [];
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        const [, , c, d, e, f] = item.transform;
        const size = Math.hypot(c, d) || item.height;
        const chars = [...item.str];
        const widths = glyphWidths(page, item.fontName, chars);
        const total = widths ? widths.reduce((s, w) => s + w, 0) : 0;
        let x = e - x0;
        for (let i = 0; i < chars.length; i++) {
          const w =
            widths && total > 0
              ? (widths[i] / total) * item.width
              : item.width / chars.length;
          text += chars[i];
          const [lo, hi] = inkHeight(chars[i]);
          boxes.push([x, f - y0 + hi * size, x + w, f - y0 + lo * size]);
          x += w;
        }
        if (item.hasEOL) {
          text += "\n";
          boxes.push([0, 0, 0, 0]);
        }
      }
      pages.push({ height: y1 - y0, text, boxes });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

// Where a character's ink sits, from its baseline, in font sizes: PDFium's
// boxes hug the ink, and the statement reader groups lines by them, so a
// dash or a comma must be as short as PDFium makes it. Heights are
// Helvetica's (Adobe's AFM glyph boxes), close enough for the sans fonts
// statements use; anything else gets capital height.
const INK = [
  ["acemnorsuvwxz", 0, 0.538],
  ["bdfhiklt", 0, 0.718],
  ["gpqy", -0.218, 0.538],
  ["j", -0.21, 0.718],
  ["-", 0.232, 0.322],
  ["_", -0.125, -0.075],
  [".", 0, 0.106],
  [",", -0.147, 0.106],
  [":", 0, 0.516],
  [";", -0.147, 0.516],
  ["*", 0.431, 0.718],
  ["'\"", 0.463, 0.718],
  ["=+", 0.115, 0.39],
  ["()[]{}/|", -0.207, 0.733],
];
const inkOf = new Map();
for (const [chars, lo, hi] of INK)
  for (const ch of chars) inkOf.set(ch, [lo, hi]);
const inkHeight = (ch) => inkOf.get(ch) ?? [0, 0.718];

// Advance widths of [chars] in the run's font, or null when pdf.js has not
// exposed the font (it keeps it in the page's commonObjs once loaded).
function glyphWidths(page, fontName, chars) {
  try {
    if (!page.commonObjs.has(fontName)) return null;
    const font = page.commonObjs.get(fontName);
    const widths = font?.widths;
    if (!widths) return null;
    const out = chars.map((ch) => {
      const w = widths[ch.codePointAt(0)];
      return typeof w === "number" ? w : null;
    });
    return out.every((w) => w !== null) ? out : null;
  } catch {
    return null;
  }
}
