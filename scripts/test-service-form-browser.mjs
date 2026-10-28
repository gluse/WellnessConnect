import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";

const root = path.resolve(import.meta.dirname, "..");
const tailwindConfig = loadConfig(path.join(root, "tailwind.config.ts"));
import { languages, deferredLanguages, verificationDate, evidencePrefix } from "./fixtures/forms-verification-scope.mjs";
const prefix = evidencePrefix("service");
const resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const keys = Object.keys(resources.en.translation.serviceForm);
for (const language of languages) {
  assert.deepEqual(Object.keys(resources[language].translation.serviceForm).sort(), [...keys].sort(), language);
  for (const key of keys) {
    assert.ok(resources[language].translation.serviceForm[key].trim(), language + ":" + key);
    assert.deepEqual(resources[language].translation.serviceForm[key].match(/{{\w+}}/g), resources.en.translation.serviceForm[key].match(/{{\w+}}/g), language + ":" + key);
  }
  for (const key of ["common.cancel", "filters.category", "filters.serviceType", "filters.group", "filters.oneToOne", "service.capacity", "serviceCleanup.label", "serviceCleanup.help", "serviceCleanup.invalid", "provider.editService", "provider.addService", "storefront.imageUploaded", "storefront.imageChoose", "storefront.imageHelp", "storefront.imageUploading", "storefront.imageUploadError", "storefront.imageReady", "publicSearch.retry"]) {
    assert.ok(key.split(".").reduce((value, part) => value?.[part], resources[language].translation), language + ":" + key);
  }
}
const javascript = (await build({
  entryPoints: [path.join(root, "scripts/fixtures/service-form.tsx")],
  bundle: true, write: false, format: "esm", platform: "browser", target: "chrome120", jsx: "automatic",
  loader: { ".css": "empty" },
  alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared") },
  define: { __SERVICE_FORM_RESOURCES__: JSON.stringify(resources), "process.env.NODE_ENV": '"test"' },
})).outputFiles[0].text;
const cssSource = await readFile(path.join(root, "client/src/index.css"), "utf8") + "\n" + await readFile(path.join(root, "client/src/components/provider/service-editor.css"), "utf8");
const css = (await postcss([tailwindcss({ ...tailwindConfig, content: [...tailwindConfig.content, "./scripts/fixtures/service-form.tsx"] })]).process(cssSource, { from: path.join(root, "client/src/index.css") })).css;
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'"><title>Isolated service form fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
const network = [];
const server = createServer((req, res) => {
  if (req.method !== "GET") { network.push(req.method + " " + req.url); res.writeHead(405).end(); return; }
  if (req.url === "/fixture.js") res.writeHead(200, { "Content-Type": "text/javascript" }).end(javascript);
  else if (req.url === "/fixture.css") res.writeHead(200, { "Content-Type": "text/css" }).end(css);
  else if (req.url === "/favicon.ico") res.writeHead(204).end();
  else res.writeHead(200, { "Content-Type": "text/html" }).end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const executable = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
assert.ok(executable, "A local Chromium browser is required; no download is attempted.");
const taskTemporaryRoot = path.resolve(tmpdir());
const profile = await mkdtemp(path.join(taskTemporaryRoot, "fits-service-forms-"));
const browser = spawn(executable, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-extensions", "--disable-sync", "--disable-features=Translate,MediaRouter,OptimizationHints", "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
let socket, api, dialogPolicy = false, dialogs = [], runtimeErrors = [], blocked = [], screenshots = [];
const checks = [];
try {
  const browserEndpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error("Chrome startup timed out")), 20000);
    browser.on("error", reject);
    browser.stderr.on("data", data => {
      stderr += data;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    browser.on("exit", code => reject(new Error("Chrome exited: " + code + " " + stderr.slice(-2000))));
  });
  const address = new URL(browserEndpoint);
  const targets = await (await fetch("http://" + address.host + "/json/list")).json();
  socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let nextId = 0; const pending = new Map();
  api = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener("message", async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task?.reject(new Error(JSON.stringify(message.error))); else task?.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Fetch.requestPaused") {
      const { request, requestId } = message.params;
      if (request.url.startsWith(origin + "/") || request.url === "about:blank") await api("Fetch.continueRequest", { requestId });
      else { blocked.push(request.url); await api("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }); }
    }
    if (message.method === "Page.javascriptDialogOpening") {
      dialogs.push(message.params.type); await api("Page.handleJavaScriptDialog", { accept: dialogPolicy });
    }
  });
  await api("Page.enable"); await api("Runtime.enable");
  await api("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  const evaluate = async (fn, arg) => {
    const result = await api("Runtime.evaluate", { expression: "(" + fn.toString() + ")(" + JSON.stringify(arg) + ")", awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (fn, label) => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) { if (await evaluate(fn)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
    throw new Error("Timed out: " + label + "\n" + JSON.stringify({ runtimeErrors, blocked, page: await evaluate(() => document.body.innerText.slice(0, 1500)) }));
  };
  const visit = async (mode = "inactive", language = "en", extra = "") => {
    dialogPolicy = true;
    await api("Page.navigate", { url: origin + "/my-services/services/7/edit?mode=" + mode + "&lang=" + language + extra });
    await until(() => !!document.getElementById("serviceName") || !!document.querySelector("p[role=alert]"), "fixture ready");
    dialogPolicy = false;
  };
  const set = async (id, value) => evaluate(async ({ id, value }) => {
    const element = document.getElementById(id);
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    await new Promise(requestAnimationFrame);
  }, { id, value });
  const pointer = async box => {
    await api("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 });
    await api("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
    await api("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
    await evaluate(() => new Promise(requestAnimationFrame));
  };
  const click = async selector => pointer(await evaluate(selector => { const element = document.querySelector(selector); if (!element) throw Error("Missing element " + selector); element.scrollIntoView({ block: "center" }); const box = element.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, selector));
  const button = async text => {
    await pointer(await evaluate(async text => { const dialog = document.querySelector('[role="alertdialog"][data-state="open"]'); const element = [...(dialog || document).querySelectorAll("button")].find(button => button.textContent.trim() === text); if (!element) throw Error("Missing button " + text); for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame); element.scrollIntoView({ block: "center" }); for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame); const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2; const hit = document.elementFromPoint(x, y); if (hit !== element && !element.contains(hit)) throw Error("Obscured button " + text); return { x, y }; }, text));
    if (text === "Keep editing") await until(() => !document.querySelector('[role="alertdialog"]'), "dialog closes and restores focus");
  };
  const value = id => evaluate(id => document.getElementById(id)?.value, id);
  const writes = () => evaluate(() => window.serviceFormFixture.writes);
  const dialog = () => until(() => !!document.querySelector('[role="alertdialog"]'), "confirmation dialog");
  const waitSave = () => until(() => location.pathname === "/my-services/services", "successful save");
  const screenshot = async name => {
    const filename = "docs/" + prefix + "-" + name + ".png";
    await until(() => document.getAnimations().every(animation => animation.playState !== "running"), "screenshot transitions finish");
    const result = await api("Page.captureScreenshot", { format: "png", captureBeyondViewport: !name.includes("dialog") });
    await writeFile(path.join(root, filename), Buffer.from(result.data, "base64")); screenshots.push(filename);
  };
  const contrast = async () => {
    await until(() => document.getAnimations().every(animation => animation.playState !== "running"), "contrast state settles");
    return evaluate(() => {
    const rgb = value => { const values = value.match(/[\d.]+/g).map(Number); return [...values.slice(0, 3), values[3] ?? 1]; };
    const blend = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
    const background = element => {
      const colors = [];
      while (element) { const color = rgb(getComputedStyle(element).backgroundColor); colors.unshift(color); element = element.parentElement; }
      return colors.reduce((previous, current) => blend(current, previous), [255, 255, 255]);
    };
    const luminance = color => color.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const ratio = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    const failures = []; const textRatios = [], borderRatios = [];
    for (const element of document.querySelectorAll(".service-editor *")) {
      if (!element.getClientRects().length || element.closest('[aria-hidden="true"]') || element.closest("button:disabled, fieldset:disabled")) continue;
      const style = getComputedStyle(element), back = background(element);
      if ([...element.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())) {
        const textRatio = ratio(blend(rgb(style.color), back), back);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        textRatios.push(textRatio);
        if (textRatio < (large ? 3 : 4.5)) failures.push({ kind: "text", text: element.textContent.slice(0, 55), ratio: textRatio });
      }
      if (element.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [role="combobox"]')) {
        const borderRatio = ratio(rgb(style.borderTopColor), background(element.parentElement));
        borderRatios.push(borderRatio);
        if (borderRatio < 3) failures.push({ kind: "border", id: element.id, ratio: borderRatio });
      }
    }
    return { failures, minText: Math.min(...textRatios), minControlBorder: Math.min(...borderRatios) };
    });
  };
  const contrastEvidence = [];
  await api("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await visit("new");
  await click('[data-testid="button-save-inactive-service"]');
  await until(() => document.querySelector('[role="alert"]')?.contains(document.activeElement), "error summary focus");
  assert.equal((await writes()).length, 0);
  assert.equal(await evaluate(() => document.getElementById("serviceName").getAttribute("aria-invalid")), "true");
  assert.ok(await evaluate(() => document.getElementById("serviceName").getAttribute("aria-describedby").includes("serviceName-error")));
  await evaluate(() => document.querySelector('[role="alert"] a').click());
  assert.equal(await evaluate(() => document.activeElement.id), "serviceName");
  checks.push("Invalid inactive save links errors, focuses summary and fields, and makes no write.");

  await visit();
  assert.equal(await evaluate(() => document.querySelector('input[name="serviceType"]:checked').value), "one_to_one");
  await click('input[name="serviceType"][value="group"]');
  assert.equal(await value("maxCapacity"), "10");
  await click('[data-testid="button-age-teens"]');
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-age-teens"]').checked), true);
  await click('[data-testid="button-gender-females"]');
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-gender-females"]').checked), true);
  assert.ok(await evaluate(() => !!document.querySelector('label[for="instantBooking"]')));
  await set("duration", ""); await click('[data-testid="button-save-inactive-service"]');
  assert.equal((await writes()).length, 0);
  await set("duration", "60"); await set("cleanupTime", "1.5"); await click('[data-testid="button-save-inactive-service"]');
  assert.equal((await writes()).length, 0);
  await set("cleanupTime", "20"); await set("externalUrl", "javascript:alert(1)"); await click('[data-testid="button-save-inactive-service"]');
  assert.equal((await writes()).length, 0);
  await set("externalUrl", "https://example.com/synthetic"); await set("serviceName", "Edited synthetic service");
  await set("fixture-result", "error"); await click('[data-testid="button-save-inactive-service"]');
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("Unable to save"), "rejected save");
  assert.equal(await value("serviceName"), "Edited synthetic service");
  assert.equal(await value("cleanupTime"), "20");
  assert.equal(await evaluate(() => document.querySelectorAll('[role="alert"] img').length), 0);
  await set("fixture-result", "forbidden"); await click('[data-testid="button-save-inactive-service"]');
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("permission"), "permission denied");
  assert.equal(await value("serviceName"), "Edited synthetic service");
  checks.push("Native audience/type semantics, capacity visibility, numeric/URL validation, rejected-write retention and denied-write feedback.");

  await set("fixture-result", "pending"); await click('[data-testid="button-save-inactive-service"]');
  await until(() => document.querySelector('form').getAttribute("aria-busy") === "true", "pending save");
  const countBefore = (await writes()).length;
  await evaluate(() => document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal((await writes()).length, countBefore);
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-save-inactive-service"]').disabled), true);
  await button("Switch workspace");
  assert.equal(await evaluate(() => window.serviceFormFixture.workspaceChanges), 0);
  await button("Resolve pending save"); await waitSave();
  assert.equal((await writes()).at(-1).isActive, false);
  assert.ok(await evaluate(() => [...document.querySelectorAll('[role="status"]')].some(node => node.textContent === "Service saved.")));
  checks.push("Pending duplicate/workspace protection, unchanged inactive payload and durable success receipt.");

  await visit("active");
  await click('[data-testid="button-save-inactive-service"]'); await dialog();
  assert.ok(await evaluate(() => document.querySelector('[role="alertdialog"]').textContent.includes("Synthetic service")));
  assert.equal(await evaluate(() => document.querySelector('[role="alertdialog"] bdi').textContent), "Synthetic service");
  assert.equal((await writes()).length, 0);
  await button("Keep editing");
  await until(() => !document.querySelector('[role="alertdialog"]'), "Keep editing closes confirmation");
  assert.equal(await evaluate(() => document.activeElement.dataset.testid), "button-save-inactive-service");
  await click('[data-testid="button-save-inactive-service"]'); await dialog(); await button("Save inactive"); await waitSave();
  assert.equal((await writes()).at(-1).isActive, false);
  await visit("inactive");
  await evaluate(() => document.querySelector("form").requestSubmit()); await waitSave();
  assert.equal((await writes()).at(-1).isActive, true);
  checks.push("Published-to-inactive confirmation supports Keep editing; publishing remains an explicit true payload.");

  await visit(); await set("serviceName", "Rejected workspace edit");
  await evaluate(() => { window.serviceFormFixture.workspaceReject = true; });
  await button("Switch workspace"); await dialog(); await button("Discard changes");
  await until(() => !document.querySelector('[role="alertdialog"]'), "rejected workspace operation settles");
  assert.equal(await value("serviceName"), "Rejected workspace edit");
  await button("Switch workspace"); await dialog(); await button("Keep editing");
  checks.push("A rejected workspace switch retains edits and restores the guard for the next exit attempt.");

  await visit(); await set("serviceName", "Retained local edit");
  await button("Switch workspace"); await dialog();
  await button("Keep editing");
  assert.equal(await value("serviceName"), "Retained local edit");
  assert.equal(await evaluate(() => window.serviceFormFixture.workspaceChanges), 0);
  await button("Switch workspace"); await dialog(); await button("Discard changes");
  await until(() => location.pathname === "/away", "workspace exit");
  assert.equal(await evaluate(() => window.serviceFormFixture.workspaceChanges), 1);
  await button("Return to editor"); await until(() => !!document.getElementById("serviceName"), "return editor");
  await set("serviceName", "Guarded history edit");
  assert.ok(await evaluate(() => [...document.querySelectorAll('[role="status"]')].some(element => element.textContent === "Unsaved changes")), "history draft is dirty before Back");
  await evaluate(() => history.back()); await dialog();
  await button("Keep editing");
  assert.equal(await value("serviceName"), "Guarded history edit");
  assert.equal(await evaluate(() => location.pathname), "/my-services/services/7/edit");
  await evaluate(() => history.back()); await dialog(); await button("Discard changes");
  await until(() => location.pathname === "/away", "history discard");
  await evaluate(() => history.forward()); await until(() => !!document.getElementById("serviceName"), "history forward");
  assert.equal(await value("serviceName"), "Synthetic service");
  await set("serviceName", "Link edit"); await click('a[href="/away"]'); await dialog();
  await button("Keep editing"); assert.equal(await value("serviceName"), "Link edit");
  assert.equal(await evaluate(() => document.activeElement.textContent.trim()), "Leave editor");
  await click('a[href="/away"]'); await dialog(); await button("Discard changes");
  await until(() => location.pathname === "/away", "link discard");
  checks.push("Workspace, Back/Forward and ordinary link exits keep or discard edits, preserve history and restore focus.");

  await visit(); await set("serviceName", "Programmatic route edit");
  await evaluate(() => history.pushState(null, "", "/away")); await dialog(); await button("Keep editing");
  assert.equal(await value("serviceName"), "Programmatic route edit");
  await evaluate(() => history.replaceState(null, "", "/away")); await dialog(); await button("Discard changes");
  await until(() => location.pathname === "/away", "programmatic route discard");
  checks.push("Programmatic push/replace route transitions are guarded before route changes.");

  await visit(); await set("serviceName", "Cancel and Back edit");
  await button("Cancel"); await dialog(); await button("Keep editing");
  assert.equal(await value("serviceName"), "Cancel and Back edit");
  await button("Back to services"); await dialog(); await button("Discard changes");
  await until(() => location.pathname === "/my-services/services", "Back action discards explicitly");
  assert.equal((await writes()).length, 0);
  checks.push("Editor Cancel and Back actions retain or discard edits explicitly without saving.");

  await visit(); await set("serviceName", "Reload guard");
  const dialogsBefore = dialogs.length;
  dialogPolicy = false; await api("Page.reload");
  await until(() => !!document.getElementById("serviceName"), "reload dismissed");
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(dialogs.length > dialogsBefore && dialogs.at(-1) === "beforeunload");
  assert.equal(await value("serviceName"), "Reload guard");
  checks.push("Reload warns and dismissed unload retains in-memory edits.");

  for (const result of ["pending", "empty", "error"]) {
    await visit("new", "en", "&categories=" + result + "&addresses=" + result);
    if (result === "pending") {
      assert.equal(await evaluate(() => document.getElementById("category").disabled), true);
      assert.equal(await evaluate(() => document.getElementById("service-address").disabled), true);
      assert.ok(await evaluate(() => document.body.textContent.includes("Loading categories") && document.body.textContent.includes("Loading addresses")));
    } else if (result === "empty") {
      await until(() => document.body.textContent.includes("Ask an administrator") && document.body.textContent.includes("Add an address"), "empty resource explanations");
    } else {
      await until(() => document.body.textContent.includes("Unable to load categories") && document.body.textContent.includes("Unable to load addresses"), "resource failure feedback");
      await evaluate(() => { window.serviceFormFixture.categoryResult = "success"; window.serviceFormFixture.addressResult = "success"; });
      const retries = await evaluate(() => [...document.querySelectorAll("main button")].filter(button => button.textContent.trim() === "Try again").length);
      assert.equal(retries, 2);
      await evaluate(() => [...document.querySelectorAll("main button")].filter(button => button.textContent.trim() === "Try again").forEach(button => button.click()));
      await until(() => !document.getElementById("category").disabled && !document.getElementById("service-address").disabled, "resource retry recovery");
    }
    assert.equal((await writes()).length, 0);
  }
  checks.push("Loading, empty and error category/address states are explained; retry recovers without writes.");

  const matrix = [];
  for (const language of languages) {
    await visit("inactive", language);
    await set("serviceName", "Synthetic العربية 123");
    for (const width of [320, 390, 639, 640, 641, 768, 1280]) {
      await api("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), language + " overflow at " + width);
      assert.ok(await evaluate(() => [...document.querySelectorAll("main button, main input:not([type=radio]):not([type=checkbox]), main select")].filter(element => element.getClientRects().length).every(element => { const box = element.getBoundingClientRect(); return box.width <= innerWidth && box.left >= -1 && box.right <= innerWidth + 1; })), language + " control bounds " + width);
      matrix.push(language + ":" + width);
    }
    assert.equal(await value("serviceName"), "Synthetic العربية 123");
    assert.equal(await evaluate(() => document.documentElement.dir), "ltr");
    assert.equal(await evaluate(() => document.documentElement.lang), language);
  }
  await set("fixture-language", "en");
  await until(() => document.documentElement.lang === "en", "language switch");
  assert.equal(await value("serviceName"), "Synthetic العربية 123");
  checks.push("en/lv/ru at 320/390/639/640/641/768/1280px reflow and mixed text; live language switching retains edits.");

  await visit("inactive", "en");
  await api("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const lightContrast = await contrast(); assert.deepEqual(lightContrast.failures, []); assert.ok(Number.isFinite(lightContrast.minControlBorder) && lightContrast.minControlBorder >= 3); contrastEvidence.push({ mode: "light", ...lightContrast });
  await screenshot("desktop");
  await api("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot("phone");
  await button("Toggle fixture theme");
  const darkContrast = await contrast(); assert.deepEqual(darkContrast.failures, []); assert.ok(Number.isFinite(darkContrast.minControlBorder) && darkContrast.minControlBorder >= 3); contrastEvidence.push({ mode: "dark", ...darkContrast });
  await api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await click('[data-testid="button-save-inactive-service"]'); await waitSave();
  await visit("active", "ru");
  await button("Toggle fixture theme");
  await set("serviceName", "Тестовая услуга");
  await button("Switch workspace"); await dialog();
  await screenshot("russian-dark-dialog");
  assert.ok(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement)));
  for (let index = 0; index < 5; index++) {
    await api("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await api("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.ok(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement)), "modal contains keyboard focus");
  }
  await evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })));
  await until(() => !document.querySelector('[role="alertdialog"]'), "Escape closes dialog");
  assert.equal(await value("serviceName"), "Тестовая услуга");

  // Text sizing/reflow and keyboard navigation are measured in the rendered DOM.
  await evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await api("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "200% text at 320px");
  await button("Switch workspace"); await dialog();
  assert.ok(await evaluate(() => { const box = document.querySelector('[role="alertdialog"]').getBoundingClientRect(); return box.top >= 0 && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }), "dialog remains inside 320px viewport at 200% text");
  await evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })));
  await until(() => !document.querySelector('[role="alertdialog"]'), "scaled dialog closes");
  await evaluate(() => { document.documentElement.style.fontSize = ""; document.getElementById("serviceName").focus(); });
  await api("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await api("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate(() => document.activeElement.id), "category");
  checks.push("Rendered screenshots; measured light/dark text and input-border contrast; reduced motion; modal focus containment/Escape; keyboard order; 200% text at 320px.");

  await visit("denied");
  assert.equal(await evaluate(() => !!document.getElementById("serviceName")), false);
  assert.equal((await writes()).length, 0);
  checks.push("Read-only permission gate prevents editor rendering and saves.");
  assert.deepEqual(network, []);
  assert.deepEqual(blocked, []);
  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(await evaluate(() => window.serviceFormFixture.unexpected), []);
  const evidence = { date: verificationDate, languages, deferredLanguages, browser: await api("Browser.getVersion"), checks, matrix, contrast: contrastEvidence, screenshots, localeKeys: keys.length, blockedUnexpectedRequests: blocked, runtimeErrors, limitations: ["This runner covers installed Chrome; see separate cross-browser evidence for Firefox/WebKit.", "No physical device, virtual keyboard or screen-reader verification.", "Translations have coverage and layout checks, but need native-language review.", "320px reflow is the CSS-width equivalent of 400% zoom at 1280px; real browser zoom was not automated."] };
  await writeFile(path.join(root, "docs/" + prefix + "-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log("Passed: " + checks.length + " browser behavior groups; " + matrix.length + " locale/width combinations; " + keys.length + " keys in en/lv/ru; zero unexpected requests/runtime exceptions.");
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await api("Browser.close"); } catch {} socket.close(); }
  if (browser.exitCode === null) browser.kill();
  await new Promise(resolve => { if (browser.exitCode !== null) resolve(); else { browser.once("exit", resolve); setTimeout(resolve, 3000); } });
  await new Promise(resolve => server.close(resolve)); server.closeAllConnections();
  const resolvedProfile = path.resolve(profile), relativeProfile = path.relative(taskTemporaryRoot, resolvedProfile);
  if (!relativeProfile || relativeProfile.startsWith("..") || path.isAbsolute(relativeProfile) || !path.basename(resolvedProfile).startsWith("fits-service-forms-")) throw Error("Refusing to remove an unexpected browser-profile path");
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
