import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { renderPrivacyPolicy } from "./privacy-policy.ts";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

const template = await readFile(new URL("../client/privacy-policy.template.html", import.meta.url), "utf8");
const details = {
  PRIVACY_POLICY_OPERATOR_NAME: 'Example Operator <img src=x onerror="alert(1)"> & Company',
  PRIVACY_POLICY_OPERATOR_ADDRESS: "Example Street 1, Riga, Latvia",
  PRIVACY_POLICY_EMAIL: "privacy+requests@example.test",
  PRIVACY_POLICY_PUBLIC_ORIGIN: "https://example.test",
  DATABASE_URL: "PRIVATE_DATABASE_SENTINEL",
  SUPABASE_SECRET_KEY: "PRIVATE_KEY_SENTINEL",
};
const html = renderPrivacyPolicy(template, details);
assert.ok(!html.includes("PRIVATE_DATABASE_SENTINEL") && !html.includes("PRIVATE_KEY_SENTINEL"));
assert.ok(!html.includes("{{"), "All template slots should be resolved");
assert.ok(renderPrivacyPolicy(template, {}).includes("Draft — configuration incomplete"));
for (const invalid of ["javascript:alert(1)", "http://example.test", "https://user:pass@example.test", "https://example.test/path", "https://example.test/?query=1"]) {
  const draft = renderPrivacyPolicy(template, { ...details, PRIVACY_POLICY_PUBLIC_ORIGIN: invalid });
  assert.ok(draft.includes("Draft — configuration incomplete"));
  assert.ok(!draft.includes('rel="canonical"'));
}
const badEmail = renderPrivacyPolicy(template, { ...details, PRIVACY_POLICY_EMAIL: 'privacy@example.test?bcc=other@example.test' });
assert.ok(badEmail.includes("Draft — configuration incomplete"));
assert.ok(!badEmail.includes("mailto:"));
const tokenText = renderPrivacyPolicy(template, { ...details, PRIVACY_POLICY_OPERATOR_NAME: "{{CONTACT}}" });
assert.ok(tokenText.includes("<strong>{{CONTACT}}</strong>"), "Configuration must never be processed as a second template");

// Vite only: this never imports Express, application startup, sessions or a DB.
const dev = await createServer({ server: { host: "127.0.0.1", port: 0 }, appType: "custom" });
try {
  await dev.listen();
  const origin = `http://127.0.0.1:${dev.httpServer.address().port}`;
  const response = await fetch(origin + "/privacy-policy.html?from=meta");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await response.text();
  assert.ok(body.includes("<h1>Privacy Policy</h1>") && body.includes('id="data-deletion"'));
  assert.ok(!body.includes('<script'), "Policy must not depend on JavaScript, including Vite's client");
  const head = await fetch(origin + "/privacy-policy.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
} finally { await dev.close(); }

await mkdir(new URL("../output/privacy-policy/", import.meta.url), { recursive: true });
const fixture = await browserFixture({ html });
try {
  await fixture.api("Emulation.setScriptExecutionDisabled", { value: true });
  await fixture.api("Page.navigate", { url: fixture.origin + "/privacy-policy.html" });
  await fixture.until(() => document.querySelector("h1")?.textContent === "Privacy Policy", "static policy rendered with scripts disabled");
  assert.equal(await fixture.evaluate(() => document.documentElement.lang), "en");
  assert.equal(await fixture.evaluate(() => document.querySelectorAll("main").length), 1);
  assert.equal(await fixture.evaluate(() => document.querySelectorAll("script, iframe, img, form").length), 0);
  assert.equal(await fixture.evaluate(() => document.querySelector('[aria-labelledby="controller"] strong').textContent), details.PRIVACY_POLICY_OPERATOR_NAME);
  assert.equal(await fixture.evaluate(() => document.querySelector('link[rel="canonical"]').href), "https://example.test/privacy-policy.html");
  assert.equal(await fixture.evaluate(() => document.querySelector('a[href^="mailto:"]').getAttribute("href")), "mailto:privacy%2Brequests@example.test");
  assert.equal(await fixture.evaluate(() => !!document.querySelector(".draft")), false);
  assert.deepEqual(await fixture.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash)), []);
  // Re-enable the harness's animation-frame helpers after proving no-script rendering.
  await fixture.api("Emulation.setScriptExecutionDisabled", { value: false });
  for (const width of [320, 768, 1280]) {
    await fixture.viewport(width);
    assert.ok(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `reflow at ${width}px`);
  }
  await fixture.api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  assert.deepEqual((await measureFormContrast(fixture, "body")).failures, []);
  await fixture.screenshot("output/privacy-policy/desktop.png");
  await fixture.viewport(320);
  await fixture.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.ok(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "200% text reflow");
  await fixture.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await fixture.api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  assert.deepEqual((await measureFormContrast(fixture, "body")).failures, []);
  await fixture.screenshot("output/privacy-policy/phone-dark.png");
  await fixture.key("Tab");
  assert.equal(await fixture.evaluate(() => document.activeElement.textContent), "Skip to privacy policy");
  await fixture.key("Enter");
  await fixture.until(() => document.activeElement.id === "policy", "skip link focuses main");
  await fixture.click('nav a[href="#data-deletion"]');
  assert.equal(await fixture.evaluate(() => location.hash), "#data-deletion");
  await fixture.api("Emulation.setEmulatedMedia", { media: "print" });
  assert.equal(await fixture.evaluate(() => getComputedStyle(document.querySelector("nav")).display), "none");
  assert.deepEqual(await fixture.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name)), []);
  assert.deepEqual(fixture.blocked, []);
  assert.deepEqual(fixture.errors, []);
  console.log("PASS: public dev GET/HEAD, no scripts/cookies, safe public configuration, static Chromium rendering, keyboard anchors, 320/768/1280px, 200% text, light/dark contrast and print.");
} finally { await fixture.close(); }

// Actual login component with existing mocked auth/API fixture, en/lv/ru only.
const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) };
const auth = await browserFixture({ entry: "scripts/fixtures/forms-auth.tsx", resources });
try {
  for (const language of ["en", "lv", "ru"]) {
    await auth.visit(`/login?lang=${language}`);
    await auth.until(() => !!document.querySelector('a[href="/privacy-policy.html"]'), "privacy link on login");
    assert.equal(await auth.evaluate(() => document.querySelector('a[href="/privacy-policy.html"]').textContent), resources[language].translation.legal.privacyPolicy);
  }
  assert.deepEqual(auth.blocked, []);
  assert.deepEqual(auth.errors, []);
  console.log("PASS: actual login privacy links in en, lv, ru with mocked APIs. Other locale verification deferred.");
} finally { await auth.close(); }
