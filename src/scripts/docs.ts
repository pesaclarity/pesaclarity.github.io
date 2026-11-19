/*
 * The developer docs' controls (src/lib/docs-html.mjs makes their HTML when
 * the site is built): copy buttons on code blocks, and tabs for code in
 * several languages. A file of this site, never inline, so the
 * Content-Security-Policy allows it by 'self'. Without it every code block
 * shows, each under its name, and nothing is lost.
 *
 * The tab last chosen (such as "dart") is kept in localStorage when the
 * browser allows it, so every set of tabs on every docs page opens on it.
 * Nothing leaves the browser.
 */

const KEY = "docs-tab";

function remembered(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function remember(tab: string) {
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    // Private windows and blocked storage: the choice lasts for the page.
  }
}

function select(group: HTMLElement, tab: string, focus = false) {
  const buttons = group.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  const want = [...buttons].some((b) => b.dataset.tab === tab)
    ? tab
    : buttons[0]?.dataset.tab;
  for (const b of buttons) {
    const on = b.dataset.tab === want;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  for (const p of group.querySelectorAll<HTMLElement>('[role="tabpanel"]')) {
    p.hidden = p.dataset.tab !== want;
  }
}

function selectEverywhere(tab: string) {
  for (const g of document.querySelectorAll<HTMLElement>("[data-tabs]")) {
    if (g.querySelector(`[role="tab"][data-tab="${CSS.escape(tab)}"]`)) {
      select(g, tab);
    }
  }
}

function setUpTabs() {
  const saved = remembered();
  for (const group of document.querySelectorAll<HTMLElement>("[data-tabs]")) {
    const list = group.querySelector<HTMLElement>('[role="tablist"]');
    if (!list) continue;
    list.hidden = false;
    group.classList.add("is-tabbed");
    select(group, saved ?? "");
    list.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>(
        '[role="tab"]',
      );
      if (!b?.dataset.tab) return;
      remember(b.dataset.tab);
      selectEverywhere(b.dataset.tab);
    });
    list.addEventListener("keydown", (e) => {
      const buttons = [
        ...list.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      ];
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (at < 0) return;
      const to =
        e.key === "ArrowRight"
          ? (at + 1) % buttons.length
          : e.key === "ArrowLeft"
            ? (at - 1 + buttons.length) % buttons.length
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : -1;
      if (to < 0) return;
      e.preventDefault();
      const tab = buttons[to].dataset.tab!;
      remember(tab);
      select(group, tab, true);
    });
  }
}

function setUpCopy() {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-copy]",
  )) {
    const code = button.closest(".code-block")?.querySelector("pre code");
    if (!code || !navigator.clipboard) continue;
    button.hidden = false;
    button.setAttribute("aria-live", "polite");
    let timer: number | undefined;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(
          (code.textContent ?? "").replace(/\n$/, ""),
        );
        button.textContent = "Copied";
      } catch {
        button.textContent = "Copy failed";
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (button.textContent = "Copy"), 2000);
    });
  }
}

setUpTabs();
setUpCopy();
