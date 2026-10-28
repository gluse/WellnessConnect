import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";

export async function serveBrowserFixture({ entry, resources, html: previewHtml }) {
  const root = path.resolve(import.meta.dirname, "../..");
  const config = loadConfig(path.join(root, "tailwind.config.ts"));
  const javascript = previewHtml ? "" : (await build({
    entryPoints: [path.join(root, entry)], bundle: true, write: false, format: "esm", platform: "browser", target: "chrome120", jsx: "automatic", loader: { ".css": "empty" },
    alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared") },
    define: { __FORM_RESOURCES__: JSON.stringify(resources), __SERVICE_FORM_RESOURCES__: JSON.stringify(resources), "process.env.NODE_ENV": '"test"' },
  })).outputFiles[0].text;
  const cssSource = previewHtml ? "" : (await Promise.all(["client/src/index.css", "client/src/components/provider/service-editor.css", "client/src/components/forms-phase2.css", "client/src/components/forms-phase3.css", "client/src/components/forms-auth.css", "client/src/components/search-page.css"].map(file => readFile(path.join(root, file), "utf8")))).join("\n");
  const css = previewHtml ? "" : (await postcss([tailwindcss({ ...config, content: [...config.content, entry] })]).process(cssSource, { from: path.join(root, "client/src/index.css") })).css;
  const html = previewHtml || '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'"><title>Isolated forms fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
  const network = [], blocked = [], errors = [];
  const server = createServer((request, response) => {
    if (request.method !== "GET") { network.push(request.method + " " + request.url); response.writeHead(405).end(); return; }
    if (request.url === "/fixture.js") response.writeHead(200, { "Content-Type": "text/javascript" }).end(javascript);
    else if (request.url === "/fixture.css") response.writeHead(200, { "Content-Type": "text/css" }).end(css);
    else if (request.url === "/favicon.ico") response.writeHead(204).end();
    else response.writeHead(200, { "Content-Type": "text/html" }).end(html);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const close = () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  return { root, origin, network, blocked, errors, close };
}

export async function browserFixture(options) {
  const served = await serveBrowserFixture(options);
  if (process.env.FORMS_BROWSER && process.env.FORMS_BROWSER !== "chrome") {
    try {
      const { playwrightFixture } = await import("./playwright-harness.mjs");
      return await playwrightFixture(served, process.env.FORMS_BROWSER);
    } catch (error) { await served.close(); throw error; }
  }
  const { root, origin, network, blocked, errors } = served;
  const executable = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  assert.ok(executable, "A local Chromium browser is required; no download is attempted.");
  const taskTemporaryRoot = path.resolve(tmpdir());
  const profile = await mkdtemp(path.join(taskTemporaryRoot, "fits-phase2-forms-"));
  const zoomArgs = [];
  if (options.nativeZoom !== undefined) {
    assert.equal(options.nativeZoom, 4, "Only the TASK-022 400% zoom preset is supported");
    await mkdir(path.join(profile, "Default"));
    // Chromium's persisted browser zoom preference, not CSS zoom or pinch scale.
    await writeFile(path.join(profile, "Default/Preferences"), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(4) / Math.log(1.2) } } }));
    zoomArgs.push("--window-size=1280,900", "--force-device-scale-factor=1");
  }
  const browser = spawn(executable, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-extensions", "--disable-sync", "--disable-features=Translate,MediaRouter,OptimizationHints", ...zoomArgs, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let socket, api;
  const close = async () => {
    if (socket?.readyState === WebSocket.OPEN) { try { await api("Browser.close"); } catch {} socket.close(); }
    if (browser.exitCode === null) browser.kill();
    await new Promise(resolve => { if (browser.exitCode !== null) resolve(); else { browser.once("exit", resolve); setTimeout(resolve, 3000); } });
    await served.close();
    const resolvedProfile = path.resolve(profile), relativeProfile = path.relative(taskTemporaryRoot, resolvedProfile);
    if (!relativeProfile || relativeProfile.startsWith("..") || path.isAbsolute(relativeProfile) || !path.basename(resolvedProfile).startsWith("fits-phase2-forms-")) throw Error("Refusing to remove an unexpected browser-profile path");
    await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let stderr = ""; const timeout = setTimeout(() => reject(Error("Chrome startup timed out")), 20000);
      browser.on("error", reject);
      browser.stderr.on("data", data => { stderr += data; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
      browser.on("exit", code => { clearTimeout(timeout); reject(Error("Chrome exited: " + code + " " + stderr.slice(-1000))); });
    });
    const address = new URL(endpoint);
    const targets = await (await fetch("http://" + address.host + "/json/list")).json();
    socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let nextId = 0; const pending = new Map();
    api = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(Error("Browser command timed out: " + method)); }, 20000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener("message", async event => {
      const message = JSON.parse(event.data);
      if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (request) clearTimeout(request.timer); if (message.error) request?.reject(Error(JSON.stringify(message.error))); else request?.resolve(message.result); }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === "Fetch.requestPaused") {
        const { request, requestId } = message.params;
        if (request.url.startsWith(origin + "/") || request.url === "about:blank") await api("Fetch.continueRequest", { requestId });
        else { blocked.push(request.url); await api("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }); }
      }
      if (message.method === "Page.javascriptDialogOpening") await api("Page.handleJavaScriptDialog", { accept: true });
    });
    await api("Page.enable"); await api("Runtime.enable"); await api("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await api("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
    const evaluate = async (fn, arg) => {
      const result = await api("Runtime.evaluate", { expression: "(" + fn.toString() + ")(" + JSON.stringify(arg) + ")", awaitPromise: true, returnByValue: true, userGesture: true, timeout: 8000 }).catch(error => { throw Error(error.message + " in " + fn.toString().slice(0, 300)); });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async (fn, label = "condition") => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) { if (await evaluate(fn)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
      throw Error("Timed out: " + label + "\n" + JSON.stringify({ errors, blocked, page: await evaluate(() => document.body.innerText.slice(0, 2000)) }));
    };
    const settle = () => until(() => document.getAnimations().every(animation => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity), "transitions finish");
    const pointer = async position => {
      await api("Input.dispatchMouseEvent", { type: "mouseMoved", x: position.x, y: position.y, buttons: 0 });
      await api("Input.dispatchMouseEvent", { type: "mousePressed", x: position.x, y: position.y, button: "left", buttons: 1, clickCount: 1 });
      await api("Input.dispatchMouseEvent", { type: "mouseReleased", x: position.x, y: position.y, button: "left", buttons: 0, clickCount: 1 });
      await evaluate(() => new Promise(requestAnimationFrame));
    };
    const click = async selector => pointer(await evaluate(async selector => {
      const element = document.querySelector(selector); if (!element) throw Error("Missing " + selector);
      // Let queued focus restoration finish before establishing pointer coordinates.
      for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame);
      element.scrollIntoView({ block: "center" });
      for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame);
      const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (hit !== element && !element.contains(hit)) throw Error("Pointer target obscured: " + selector + " by " + hit?.outerHTML.slice(0, 180) + " at " + x + "," + y);
      return { x, y };
    }, selector));
    const button = async text => pointer(await evaluate(async text => {
      const dialog = document.querySelector('[role="alertdialog"][data-state="open"]') || document.querySelector('[role="dialog"][data-state="open"]');
      const element = [...(dialog || document).querySelectorAll("button")].find(button => button.textContent.trim() === text && button.getClientRects().length);
      if (!element) throw Error("Missing button " + text);
      // Let queued focus restoration finish before establishing pointer coordinates.
      for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame);
      element.scrollIntoView({ block: "center" });
      for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame);
      const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (hit !== element && !element.contains(hit)) throw Error("Button obscured: " + text + " by " + hit?.outerHTML.slice(0, 220) + " at " + x + "," + y);
      return { x, y };
    }, text));
    const set = async (id, value) => evaluate(async ({ id, value }) => {
      const element = document.getElementById(id); if (!element) throw Error("Missing field " + id);
      const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
      element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      await new Promise(requestAnimationFrame);
    }, { id, value });
    const visit = async route => { await api("Page.navigate", { url: origin + route }); await until(() => !!window.phase2Fixture?.ready, "fixture ready"); };
    const viewport = async (width, height = 900) => { await api("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }); await evaluate(() => new Promise(requestAnimationFrame)); };
    const key = async value => { const codes = { Tab: 9, Escape: 27, Enter: 13, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 }; await api("Input.dispatchKeyEvent", { type: "keyDown", key: value, code: value, windowsVirtualKeyCode: codes[value] || 13, ...(value === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}) }); await api("Input.dispatchKeyEvent", { type: "keyUp", key: value, code: value, windowsVirtualKeyCode: codes[value] || 13 }); };
    const screenshot = async (file, fullPage = true) => { await settle(); const result = await api("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage }); await writeFile(path.join(root, file), Buffer.from(result.data, "base64")); };
    return { root, origin, api, evaluate, until, settle, click, button, set, visit, viewport, key, screenshot, close, network, blocked, errors };
  } catch (error) { await close(); throw error; }
}

export async function measureFormContrast(fixture, selector = ".phase2-form") {
  await fixture.settle();
  return fixture.evaluate(selector => {
    const rgb = value => { const values = value.match(/[\d.]+/g).map(Number); return [...values.slice(0, 3), values[3] ?? 1]; };
    const blend = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
    const background = element => {
      const colors = []; while (element) { colors.unshift(rgb(getComputedStyle(element).backgroundColor)); element = element.parentElement; }
      return colors.reduce((previous, current) => blend(current, previous), [255, 255, 255]);
    };
    const luminance = color => color.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const ratio = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    const failures = [], textRatios = [], borderRatios = [];
    for (const element of document.querySelectorAll(selector + " *")) {
      if (!element.getClientRects().length || element.closest('[aria-hidden="true"],button:disabled,fieldset:disabled')) continue;
      const style = getComputedStyle(element), back = background(element);
      if ([...element.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())) {
        const textRatio = ratio(blend(rgb(style.color), back), back);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        textRatios.push(textRatio);
        if (!Number.isFinite(textRatio) || textRatio < (large ? 3 : 4.5)) failures.push({ kind: "text", text: element.textContent.slice(0, 50), ratio: textRatio });
      }
      // Native checkbox/radio paint is not represented by computed border colors.
      // Their visible states still need visual/assistive-technology review.
      if (element.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,select')) {
        const borderRatio = ratio(rgb(style.borderTopColor), background(element.parentElement));
        borderRatios.push(borderRatio);
        if (!Number.isFinite(borderRatio) || borderRatio < 3) failures.push({ kind: "border", id: element.id, ratio: borderRatio });
      }
    }
    return { failures, minText: Math.min(...textRatios), minControlBorder: Math.min(...borderRatios) };
  }, selector);
}
