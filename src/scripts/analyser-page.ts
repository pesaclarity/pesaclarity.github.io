/*
 * The statement analyser page. The PDF and its password go only to the
 * analyser's Web Worker (public/analyser/worker.mjs), in memory; nothing is
 * stored or sent. "Clear" ends the worker and forgets everything.
 */
import { money, summarise, type Analysis, type Row } from "./analyser-summary";

const root = document.querySelector<HTMLElement>("[data-analyser]")!;
const workerUrl = root.dataset.worker!;
const $ = <T extends HTMLElement = HTMLElement>(name: string) =>
  root.querySelector<T>(`[data-${name}]`)!;

// WasmGC (a struct type) and the new exception handling (try_table): what
// Dart's wasm needs. Without them, the page asks for a newer browser.
const gc = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 3, 1, 0x5f, 0]);
const exn = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 0x60, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6, 0,
  0x1f, 0x40, 0, 0x0b, 0x0b,
]);
function supported(): boolean {
  try {
    return (
      typeof Worker === "function" &&
      WebAssembly.validate(gc) &&
      WebAssembly.validate(exn)
    );
  } catch {
    return false;
  }
}

type View = "choose" | "password" | "reading" | "results" | "unsupported";
const views: View[] = [
  "choose",
  "password",
  "reading",
  "results",
  "unsupported",
];
function show(view: View, focus = true) {
  for (const v of views) $(`view-${v}`).hidden = v !== view;
  root.dataset.view = view;
  $("clear").hidden = view === "choose" || view === "unsupported";
  if (focus) $(`view-${view}`).querySelector<HTMLElement>("h1, h2")?.focus();
}

// What the page holds, all in memory: forgotten by clear().
let worker: Worker | null = null;
let file: { name: string; size: number; bytes: ArrayBuffer } | null = null;
let runId = 0;

function startWorker() {
  worker = new Worker(workerUrl, { type: "module" });
  worker.onmessage = ({ data }) => onMessage(data);
  worker.onerror = () => fail("engine");
}

function clear() {
  worker?.terminate();
  worker = null;
  file = null;
  runId += 1;
  $<HTMLInputElement>("file").value = "";
  $<HTMLInputElement>("password").value = "";
  $("results").replaceChildren();
  $("choose-error").textContent = "";
  $("password-error").textContent = "";
  startWorker();
  show("choose");
  $("status").textContent = "Cleared. The statement and its results are gone.";
}

function setFileCard(locked: boolean) {
  if (!file) return;
  const size =
    file.size < 1024 * 1024
      ? `${Math.max(1, Math.round(file.size / 1024))} KB`
      : `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  for (const el of root.querySelectorAll("[data-file-name]"))
    el.textContent = file.name;
  for (const el of root.querySelectorAll("[data-file-detail]"))
    el.textContent = locked ? `Locked · ${size}` : size;
}

async function open(f: File) {
  if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
    $("choose-error").textContent =
      "That is not a PDF. Choose the statement PDF.";
    return;
  }
  file = { name: f.name, size: f.size, bytes: await f.arrayBuffer() };
  $<HTMLInputElement>("file").value = "";
  analyse();
}

function analyse(password?: string) {
  if (!file || !worker) return;
  runId += 1;
  setFileCard(password !== undefined);
  setSteps(0);
  show("reading");
  // A copy goes to the worker; the page keeps its own until Clear.
  worker.postMessage({
    id: runId,
    type: "analyse",
    bytes: file.bytes.slice(0),
    password,
  });
}

function setSteps(done: number, count?: number) {
  const steps = root.querySelectorAll<HTMLElement>("[data-step]");
  steps.forEach((s, i) => {
    s.dataset.state = i < done ? "done" : i === done ? "now" : "todo";
  });
  if (count !== undefined)
    $("step-count").textContent = `Read ${count} transactions`;
  $<HTMLProgressElement>("progress").value = done;
}

function onMessage(data: any) {
  if (data.type === "ready") return;
  if (data.id !== undefined && data.id !== runId) return;
  if (data.type === "progress") setSteps(1);
  else if (data.type === "result") done(data.analysis as Analysis);
  else if (data.type === "error") fail(data.error);
}

function fail(error: string) {
  if (error === "password" || error === "wrong_password") {
    setFileCard(true);
    $("password-error").textContent =
      error === "wrong_password"
        ? "That password did not open it. Try again."
        : "";
    $<HTMLInputElement>("password").value = "";
    $<HTMLInputElement>("password").setAttribute(
      "aria-invalid",
      String(error === "wrong_password"),
    );
    show("password");
    if (error === "wrong_password") $("password").focus();
    return;
  }
  if (error === "engine" && !file) {
    show("unsupported");
    return;
  }
  file = null;
  $("choose-error").textContent =
    error === "unreadable"
      ? "That PDF could not be read. Choose an M-Pesa or KCB statement PDF."
      : "Something went wrong reading it. Reload the page and try again.";
  show("choose");
}

function done(analysis: Analysis) {
  if (analysis.status !== "read" || !analysis.transactions?.length) {
    file = null;
    $("choose-error").textContent =
      analysis.status === "no_text"
        ? "That PDF has no text to read (it may be a scan). Choose the statement PDF from M-Pesa or your bank."
        : "That is not an M-Pesa or KCB statement this page can read yet.";
    show("choose");
    return;
  }
  setSteps(2, analysis.transactions.length);
  render(analysis);
  setSteps(3, analysis.transactions.length);
  show("results");
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

function rowList(
  rows: Row[],
  max: number,
  more: (n: number) => string,
  bars: boolean,
) {
  const top = rows[0]?.minor || 1;
  const list = el("ul", { class: "an-list", role: "list" });
  rows.forEach((r, i) => {
    const li = el(
      "li",
      { class: "an-row" },
      el(
        "div",
        { class: "an-row-text" },
        el("span", { class: "an-row-label" }, r.label),
        ...(r.detail ? [el("span", { class: "an-row-detail" }, r.detail)] : []),
      ),
      el("span", { class: "an-row-amount number" }, money(r.minor)),
    );
    if (bars) {
      const meter = el("span", { class: "an-meter", "aria-hidden": "true" });
      meter.style.setProperty("--w", `${Math.max(2, (r.minor / top) * 100)}%`);
      li.append(meter);
    }
    if (i >= max) li.hidden = true;
    list.append(li);
  });
  const wrap = el("div", { class: "an-card an-card-list" }, list);
  if (rows.length > max) {
    const button = el(
      "button",
      { type: "button", class: "an-more", "aria-expanded": "false" },
      more(rows.length - max),
    );
    button.addEventListener("click", () => {
      for (const li of list.children) (li as HTMLElement).hidden = false;
      button.remove();
      (list.children[max] as HTMLElement | undefined)?.setAttribute(
        "tabindex",
        "-1",
      );
      (list.children[max] as HTMLElement | undefined)?.focus();
    });
    wrap.append(button);
  }
  return wrap;
}

function chart(
  bars: { label: string; inMinor: number; outMinor: number }[],
  title: string,
) {
  const max = Math.max(1, ...bars.flatMap((b) => [b.inMinor, b.outMinor]));
  const svgNs = "http://www.w3.org/2000/svg";
  const w = 100 / bars.length;
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", "0 0 100 50");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "an-chart-svg");
  bars.forEach((b, i) => {
    for (const [j, v] of [b.inMinor, b.outMinor].entries()) {
      const h = (v / max) * 48;
      const r = document.createElementNS(svgNs, "rect");
      r.setAttribute("x", String(i * w + w * 0.14 + j * w * 0.37));
      r.setAttribute("width", String(w * 0.33));
      r.setAttribute("y", String(50 - h));
      r.setAttribute("height", String(h));
      r.setAttribute("class", j ? "an-bar-out" : "an-bar-in");
      svg.append(r);
    }
  });
  const labels = el("div", { class: "an-chart-labels", "aria-hidden": "true" });
  labels.style.setProperty("--n", String(bars.length));
  for (const b of bars) labels.append(el("span", {}, b.label));
  // The same numbers as a table, for screen readers.
  const table = el(
    "table",
    { class: "visually-hidden" },
    el("caption", {}, `${title}, in shillings`),
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", { scope: "col" }, "Period"),
        el("th", { scope: "col" }, "In"),
        el("th", { scope: "col" }, "Out"),
      ),
    ),
    el(
      "tbody",
      {},
      ...bars.map((b) =>
        el(
          "tr",
          {},
          el("th", { scope: "row" }, b.label),
          el("td", {}, money(b.inMinor)),
          el("td", {}, money(b.outMinor)),
        ),
      ),
    ),
  );
  return el(
    "figure",
    { class: "an-card an-chart" },
    el("figcaption", { class: "an-chart-title" }, title),
    svg,
    labels,
    el(
      "p",
      { class: "an-legend", "aria-hidden": "true" },
      el("span", { class: "an-key an-key-in" }),
      "In",
      el("span", { class: "an-key an-key-out" }),
      "Out",
    ),
    table,
  );
}

function render(analysis: Analysis) {
  const s = summarise(analysis);
  const section = (title: string, extra?: string) => {
    const head = el(
      "div",
      { class: "an-section-head" },
      el("h2", { class: "an-label" }, title),
    );
    if (extra) head.append(el("span", { class: "an-label-side" }, extra));
    return head;
  };
  const stat = (label: string, minor: number, detail: string, cls: string) =>
    el(
      "div",
      { class: "an-card an-stat" },
      el("p", { class: "an-stat-label" }, label),
      el(
        "p",
        { class: `an-stat-value number ${cls}`, "data-value": label },
        money(minor),
      ),
      el("p", { class: "an-stat-detail" }, detail),
    );

  const main = el(
    "div",
    { class: "an-col" },
    el(
      "div",
      { class: "an-stats" },
      stat("Money in", s.inMinor, s.inDetail, "an-in"),
      stat("Money out", s.outMinor, s.outDetail, ""),
    ),
    chart(s.bars, s.chartTitle),
    section("By category", "Out"),
    rowList(s.categories, 5, (n) => `${n} more`, true),
  );
  const side = el(
    "div",
    { class: "an-col" },
    section("Top payees"),
    rowList(s.payees, 3, () => `See all ${s.payees.length} payees`, false),
    section("Fees"),
    el(
      "div",
      { class: "an-card an-card-list" },
      el(
        "div",
        { class: "an-row" },
        el(
          "div",
          { class: "an-row-text" },
          el("span", { class: "an-row-label" }, "Charges paid"),
          el("span", { class: "an-row-detail" }, s.feesDetail),
        ),
        el(
          "span",
          { class: "an-row-amount number", "data-value": "Fees" },
          money(s.feesMinor),
        ),
      ),
    ),
    el(
      "div",
      { class: "an-card an-app" },
      el("h2", { class: "an-app-title" }, "Keep going in the app"),
      el(
        "p",
        {},
        "Pesa Clarity reads your M-Pesa and bank messages from now on, on your phone, and turns them into a plan. Free, and nothing leaves your phone.",
      ),
      el(
        "a",
        { class: "button button-primary an-wide", href: root.dataset.install! },
        "Get the app",
      ),
    ),
  );
  const head = el(
    "div",
    { class: "an-head" },
    el("h2", { class: "an-title", tabindex: "-1" }, s.title),
    el("p", { class: "an-sub" }, s.subtitle),
  );
  if (s.unreadCount > 0)
    head.append(
      el(
        "p",
        { class: "an-note" },
        `${s.unreadCount} ${s.unreadCount === 1 ? "line" : "lines"} could not be read, so the totals may be a little off.`,
      ),
    );
  $("results").replaceChildren(
    head,
    el("div", { class: "an-grid" }, main, side),
  );
  $("status").textContent =
    `${s.title}: money in ${money(s.inMinor)}, money out ${money(s.outMinor)} shillings.`;
}

// Wiring.
if (!supported()) {
  show("unsupported", false);
} else {
  startWorker();
  show("choose", false);
  const input = $<HTMLInputElement>("file");
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) void open(f);
  });
  const drop = $("drop");
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.dataset.over = "true";
  });
  drop.addEventListener("dragleave", () => delete drop.dataset.over);
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    delete drop.dataset.over;
    const f = e.dataTransfer?.files?.[0];
    if (f) void open(f);
  });
  $<HTMLFormElement>("password-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = $<HTMLInputElement>("password").value;
    if (!pw) {
      $("password-error").textContent = "Type the password first.";
      $("password").focus();
      return;
    }
    $<HTMLInputElement>("password").value = "";
    analyse(pw);
  });
  for (const b of root.querySelectorAll("[data-change]"))
    b.addEventListener("click", () => clear());
  $("clear").addEventListener("click", () => clear());
}
