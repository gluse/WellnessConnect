import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Optional external test tooling; no app dependency or connected server required.
export async function loadFormsPlaywright() {
  assert.ok(process.env.FORMS_PLAYWRIGHT_MODULE, "Set FORMS_PLAYWRIGHT_MODULE to an installed playwright index.mjs");
  return import(pathToFileURL(path.resolve(process.env.FORMS_PLAYWRIGHT_MODULE)).href);
}

export async function playwrightFixture(served, engine) {
  assert.ok(["firefox", "webkit"].includes(engine), "Unsupported forms browser: " + engine);
  const playwright = await loadFormsPlaywright();
  const browser = await playwright[engine].launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({ timezoneId: "UTC", serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", error => served.errors.push(error.message));
    page.on("dialog", dialog => void dialog.accept());
    await context.route("**/*", route => {
      if (route.request().url().startsWith(served.origin + "/")) return route.continue();
      served.blocked.push(route.request().url()); return route.abort("blockedbyclient");
    });
    const evaluate = (fn, arg) => page.evaluate(fn, arg);
    const until = (fn, label = "condition") => page.waitForFunction(fn, undefined, { timeout: 8000 }).catch(error => { throw Error(label + ": " + error.message); });
    // Firefox can keep background color transitions running in the hidden/inert
    // page behind an open modal. Wait for the visible surface, including its
    // opening/closing animation, rather than those inaccessible background nodes.
    const settle = () => until(() => document.getAnimations().every(animation =>
      animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity ||
      animation.effect?.target?.closest('[aria-hidden="true"], [inert]')), "transitions finish");
    const frame = () => evaluate(() => new Promise(requestAnimationFrame));
    const click = async selector => { await page.locator(selector).first().click(); await frame(); };
    const button = async text => {
      const dialog = page.locator('[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"]');
      const scope = await dialog.count() ? dialog.first() : page;
      // Match the visible text just as the existing Chrome fixture helper does.
      const buttons = scope.locator("button");
      for (let index = 0; index < await buttons.count(); index++) {
        const candidate = buttons.nth(index);
        if ((await candidate.textContent()).trim() === text && await candidate.isVisible()) { await candidate.click(); await frame(); return; }
      }
      throw Error("Missing button " + text);
    };
    const set = (id, value) => page.locator('[id="' + id + '"]').evaluate(async (element, value) => {
      const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
      element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      await new Promise(requestAnimationFrame);
    }, value);
    const visit = async route => { await page.goto(served.origin + route); await until(() => !!window.phase2Fixture?.ready || (!!window.serviceFormFixture && !!document.querySelector('#serviceName, p[role="alert"]')), "fixture ready"); };
    const viewport = async (width, height = 900) => { await page.setViewportSize({ width, height }); await frame(); };
    const key = value => page.keyboard.press(value);
    const screenshot = async (file, fullPage = true) => { await settle(); await page.screenshot({ path: path.join(served.root, file), fullPage }); };
    const api = async (method, params) => {
      if (method === "Browser.getVersion") return { product: engine + "/" + browser.version() };
      if (method === "Emulation.setEmulatedMedia") {
        const motion = params.features.find(feature => feature.name === "prefers-reduced-motion");
        assert.ok(motion, "Unsupported media emulation"); return page.emulateMedia({ reducedMotion: motion.value });
      }
      throw Error("Unsupported forms browser command: " + method);
    };
    const close = async () => { try { await context.close(); } finally { try { await browser.close(); } finally { await served.close(); } } };
    return { ...served, api, evaluate, until, settle, click, button, set, visit, viewport, key, screenshot, close };
  } catch (error) { await context?.close(); await browser.close(); throw error; }
}
