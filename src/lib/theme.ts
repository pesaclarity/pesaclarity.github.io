/*
 * The site's only script: the colour theme switch. It runs inline in <head>,
 * before the page is drawn, so a chosen theme shows with no flash.
 *
 * System (the default) follows the device. Light or Dark sets data-theme on
 * <html>, which tokens.css reads. The choice is kept in localStorage when the
 * browser allows it, and works for the visit when it does not. Nothing leaves
 * the browser.
 *
 * The Content-Security-Policy in netlify.toml allows this script by its hash.
 * When you change it, build, and put the new hash there; the dist tests say
 * which hash they expect.
 */

/** The browser bar colour for each theme: the page background. */
export const themeColours = { light: "#f5f5f5", dark: "#121212" } as const;

export const themeScript = `(function () {
  var root = document.documentElement;
  var key = "theme";
  var order = ["system", "light", "dark"];
  var names = { system: "System", light: "Light", dark: "Dark" };
  var colours = ${JSON.stringify(themeColours)};
  var choice = "system";
  try {
    var saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") choice = saved;
  } catch (e) {}

  function apply() {
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    root.setAttribute("data-theme-choice", choice);
    var scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) scheme.content = choice === "system" ? "light dark" : choice;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var own = /dark/.test(metas[i].media) ? "dark" : "light";
      metas[i].content = colours[choice === "system" ? own : choice];
    }
    var next = names[order[(order.indexOf(choice) + 1) % order.length]];
    var buttons = document.querySelectorAll("[data-theme-switch]");
    for (var j = 0; j < buttons.length; j++) {
      var b = buttons[j];
      b.setAttribute("aria-label", "Theme: " + names[choice] + ". Change to " + next);
      b.title = "Change to " + next;
      var name = b.querySelector("[data-theme-name]");
      if (name) name.textContent = names[choice];
    }
  }

  apply();
  document.addEventListener("DOMContentLoaded", apply);
  document.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("[data-theme-switch]");
    if (!button) return;
    choice = order[(order.indexOf(choice) + 1) % order.length];
    try {
      if (choice === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, choice);
    } catch (e) {}
    apply();
    var status = document.querySelector("[data-theme-status]");
    if (status) status.textContent = "Theme: " + names[choice];
  });
  window.addEventListener("storage", function (event) {
    if (event.key !== key) return;
    choice = event.newValue === "light" || event.newValue === "dark" ? event.newValue : "system";
    apply();
  });
})();`;
