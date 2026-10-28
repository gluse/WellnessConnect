import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture } from "./fixtures/browser-harness.mjs";
import { languages, deferredLanguages, verificationDate } from "./fixtures/forms-verification-scope.mjs";

assert.ok(!process.env.FORMS_BROWSER || process.env.FORMS_BROWSER === "chrome", "Native zoom runner uses installed Chrome");
const root = path.resolve(import.meta.dirname, ".."), resources = {}, cases = [];
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const groups = [
  { name: "service", entry: "scripts/fixtures/service-form.tsx", views: [{ name: "editor", route: "/my-services/services/7/edit?mode=inactive", ready: "#serviceName", scope: ".service-editor" }] },
  { name: "auth", entry: "scripts/fixtures/forms-auth.tsx", views: [{ name: "login", route: "/login?returnTo=%2Finvite", ready: "#email", scope: ".auth-form" }, { name: "signup", route: "/login?", ready: "#email", scope: ".auth-form", signup: true }] },
  { name: "phase2", entry: "scripts/fixtures/forms-phase2.tsx", views: [{ name: "account", route: "/account?", ready: "#account-name", scope: ".phase2-form" }, { name: "address", route: "/account?", ready: "#account-name", scope: ".phase2-form", address: true }, { name: "booking", route: "/?mode=booking", ready: "#open-booking", scope: '[role="dialog"]', booking: true }, { name: "booking-review", route: "/?mode=booking", ready: "#open-booking", scope: '[role="dialog"]', booking: true, review: true }] },
  { name: "phase3", entry: "scripts/fixtures/forms-phase3.tsx", views: ["availability", "team", "filters", "categories", "storefront", "subscriptions"].map(name => ({ name, route: "/?mode=" + name, ready: { availability: "#availability-timezone", team: "#team-email", filters: "#admin-user-search", categories: "#category-key", storefront: "#storefront-name", subscriptions: "#subscription-target" }[name], scope: ".phase3-form" })) },
];
for (const group of groups) {
  const fixture = await browserFixture({ entry: group.entry, resources, nativeZoom: 4 });
  try {
    for (const view of group.views) for (const language of languages) {
      await fixture.api("Page.navigate", { url: fixture.origin + view.route + "&lang=" + language });
      await fixture.until(new Function("return !!document.querySelector(" + JSON.stringify(view.ready) + ")"), "zoom fixture " + view.name);
      if (view.signup) { await fixture.button(resources[language].translation.authForm.switchSignup); await fixture.until(() => !!document.getElementById("confirm-password")); }
      if (view.booking) { await fixture.click("#open-booking button"); await fixture.until(() => !!document.querySelector('[role="dialog"]')); }
      if (view.review) {
        await fixture.until(() => !!document.querySelector('button[name="day"]:not([disabled])'));
        await fixture.click('button[name="day"]:not([disabled])'); await fixture.until(() => !!document.querySelector('button[aria-pressed="false"]'));
        await fixture.click('button[aria-pressed="false"]'); await fixture.button(resources[language].translation.bookingForm.continue);
        await fixture.until(() => !!document.getElementById("booking-notes"));
      }
      if (view.address) { await fixture.button(resources[language].translation.addressForm.add); await fixture.until(() => !!document.getElementById("address")); await fixture.click("details summary"); }
      if (view.name === "filters") await fixture.click("details summary");
      await fixture.settle();
      const metrics = await fixture.evaluate(scope => {
        const fields = [...document.querySelectorAll(scope + " input," + scope + " select," + scope + " textarea," + scope + " button")].filter(element => element.getClientRects().length && !element.closest('[aria-hidden="true"]'));
        return { outerWidth, innerWidth, height: innerHeight, dpr: devicePixelRatio, scale: visualViewport.scale, cssZoom: getComputedStyle(document.documentElement).zoom, scrollWidth: document.documentElement.scrollWidth,
          controls: fields.length, clipped: fields.filter(element => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; }).map(element => element.id || element.textContent.trim().slice(0, 40)) };
      }, view.scope);
      assert.equal(metrics.outerWidth, 1280, "fixed browser window");
      assert.ok(metrics.innerWidth >= 300 && metrics.innerWidth <= 320, "native zoom reflows the 1280px browser window to at most 320 CSS px, accounting for window borders: " + JSON.stringify(metrics));
      assert.equal(metrics.dpr, 4, "browser zoom changes DPR");
      assert.equal(metrics.scale, 1, "no pinch scaling"); assert.equal(Number(metrics.cssZoom), 1, "no CSS zoom");
      assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, view.name + "/" + language + " page reflow");
      assert.ok(metrics.controls > 0); assert.deepEqual(metrics.clipped, [], view.name + "/" + language + " control bounds");
      // Scroll each enabled text control into view: keyboard focus must stay visible.
      const focus = await fixture.evaluate(scope => {
        const fields = [...document.querySelectorAll(scope + " input," + scope + " select," + scope + " textarea")].filter(element => !element.disabled && element.getClientRects().length && !element.closest('[aria-hidden="true"]') && !element.matches('[type="hidden"]'));
        return fields.map(element => { element.focus(); element.scrollIntoView({ block: "center" }); const box = element.getBoundingClientRect(); return { id: element.id, focused: document.activeElement === element, visible: box.bottom > 0 && box.top < innerHeight }; });
      }, view.scope);
      assert.ok(focus.every(field => field.focused && field.visible), view.name + " reachable fields: " + JSON.stringify(focus));
      let screenshot;
      if (language === "en") { screenshot = "docs/forms-task022-zoom-" + view.name + ".png"; await fixture.screenshot(screenshot, false); }
      cases.push({ group: group.name, view: view.name, language, metrics, focus, screenshot });
      assert.deepEqual(await fixture.evaluate(() => (window.serviceFormFixture || window.phase2Fixture).unexpected), []);
    }
    assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  } finally { await fixture.close(); }
}
await writeFile(path.join(root, "docs/forms-task022-zoom-evidence.json"), JSON.stringify({ date: verificationDate, languages, deferredLanguages, method: "Disposable Chrome profile partition.default_zoom_level.x = log(4)/log(1.2); 1280px browser window; no viewport/device emulation or CSS/pinch zoom", cases, limits: "Isolated mocked fixtures. No physical devices, screen reader, native-speaker review, connected APIs/database or deployment." }, null, 2) + "\n");
console.log("Passed native Chrome 400% zoom: " + cases.length + " en/lv/ru form views; no horizontal overflow or clipped controls.");
