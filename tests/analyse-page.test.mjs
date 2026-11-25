// The statement analyser page, in headless Chromium: opens a made-up locked
// statement, checks the password flow, that the numbers shown match the
// app's goldens, that nothing is requested from anywhere but this site, and
// that Clear forgets everything. Run `npm run build` first.
//
// Needs playwright-core and a Chromium. Skipped when playwright-core cannot
// be found; set PLAYWRIGHT_CORE to its folder to point at one elsewhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");

async function loadPlaywright() {
  for (const spec of [process.env.PLAYWRIGHT_CORE, "playwright-core"]) {
    if (!spec) continue;
    try {
      const m = await import(
        spec.startsWith("/") ? join(spec, "index.mjs") : spec
      );
      return m.chromium ?? m.default?.chromium;
    } catch {}
  }
  return null;
}
const chromium = await loadPlaywright();

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".webp": "image/webp",
};

function serve() {
  const server = createServer((req, res) => {
    let path = normalize(
      decodeURIComponent(new URL(req.url, "http://x").pathname),
    );
    let file = join(dist, path);
    if (existsSync(file) && statSync(file).isDirectory())
      file = join(file, "index.html");
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

const fixture = "mpesa_month_locked";
const password = "4321";
const golden = JSON.parse(
  readFileSync(join(root, `analyser/goldens/${fixture}.golden.json`), "utf8"),
);
const shillings = (minor) => Math.round(minor / 100).toLocaleString("en-KE");

test(
  "the analyser page reads a locked statement and forgets it on Clear",
  { skip: !chromium && "playwright-core not found", timeout: 120_000 },
  async () => {
    const server = await serve();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const requests = [];
      page.on("request", (r) => requests.push(r.url()));
      // Worker requests too.
      page.context().on("request", (r) => requests.push(r.url()));
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));

      await page.goto(`${origin}/analyse/`);
      await page
        .locator("[data-file]")
        .setInputFiles(join(root, `analyser/fixtures/${fixture}.pdf`));

      // A locked PDF asks for its password; a wrong one says so.
      await page.locator("[data-view-password]").waitFor();
      await page.getByLabel("Password").fill(`${password}9`);
      await page.getByRole("button", { name: "Open" }).click();
      await page
        .getByText("That password did not open it. Try again.")
        .waitFor();
      await page.getByLabel("Password").fill(password);
      await page.getByLabel("Password").press("Enter");
      await page.locator("[data-view-results]").waitFor({ timeout: 60_000 });

      const t = golden.transactions;
      const inMinor = t
        .filter((x) => x.direction === "inflow")
        .reduce((s, x) => s + x.amountMinor, 0);
      const outMinor = t
        .filter((x) => x.direction === "outflow")
        .reduce((s, x) => s + x.amountMinor + x.feeMinor, 0);
      const fees = t.reduce((s, x) => s + x.feeMinor, 0);
      const value = (name) =>
        page.locator(`[data-value="${name}"]`).textContent();
      assert.equal(await value("Money in"), shillings(inMinor));
      assert.equal(await value("Money out"), shillings(outMinor));
      assert.equal(await value("Fees"), shillings(fees));
      assert.equal(
        await page.locator("[data-results] h2.an-title").textContent(),
        "October 2026",
      );
      assert.match(
        await page.locator("[data-results] .an-sub").textContent(),
        new RegExp(`${t.length} transactions`),
      );
      // The largest category, as the app categorised it.
      const byCat = new Map();
      for (const x of t.filter((x) => x.direction === "outflow"))
        byCat.set(x.category, (byCat.get(x.category) ?? 0) + x.amountMinor);
      const top = Math.max(...byCat.values());
      assert.equal(
        await page.locator(".an-row-amount").first().textContent(),
        shillings(top),
      );

      // Nothing from anywhere but this site.
      const outside = requests.filter(
        (u) =>
          !u.startsWith(origin) &&
          !u.startsWith("data:") &&
          !u.startsWith("blob:"),
      );
      assert.deepEqual(outside, []);
      assert.ok(requests.some((u) => u.endsWith("/analyser/engine.wasm")));

      // Clear wipes the results and the password, and starts over.
      await page.getByRole("button", { name: "Clear" }).click();
      await page.locator("[data-view-choose]").waitFor();
      assert.equal(await page.locator("[data-results]").innerHTML(), "");
      assert.equal(await page.getByLabel("Password").inputValue(), "");
      assert.equal(await page.locator("[data-file]").inputValue(), "");
      assert.equal(await page.locator("[data-view-results]").isHidden(), true);
      assert.equal(
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  },
);
