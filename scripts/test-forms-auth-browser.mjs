import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";
const root = path.resolve(import.meta.dirname, ".."), languages = ["en", "lv", "es", "zh", "hi", "ar", "pt", "ru", "ja", "de", "fr"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const messages = resources.en.translation.authForm, keys = Object.keys(messages);
for (const language of languages) {
  const translated = resources[language].translation.authForm;
  assert.deepEqual(Object.keys(translated).sort(), [...keys].sort());
  for (const key of keys) { assert.ok(typeof translated[key] === "string" && translated[key].trim(), language + ":" + key); assert.deepEqual(translated[key].match(/{{\w+}}/g)?.sort(), messages[key].match(/{{\w+}}/g)?.sort(), language + ":" + key); }
}
for (const file of ["client/src/pages/login.tsx", "client/src/components/invitation-recovery.tsx"]) for (const [, key] of (await readFile(path.join(root, file), "utf8")).matchAll(/authForm\.(\w+)/g)) assert.ok(messages[key], "Missing auth message: " + key);
const fixture = await browserFixture({ entry: "scripts/fixtures/forms-auth.tsx", resources });
const { api, evaluate, until, settle, click, button, set, visit, viewport, key, screenshot } = fixture;
const checks = [], matrix = [], contrast = [], screenshots = [];
const config = options => evaluate(options => { Object.assign(window.authFixture, options); }, options);
const writes = () => evaluate(() => window.authFixture.writes);
const value = id => evaluate(id => document.getElementById(id)?.value, id);
async function open(extra = "") { assert.deepEqual(await evaluate(() => window.authFixture?.unexpected || []), []); await visit("/login?" + extra); await until(() => !!document.getElementById("email"), "auth fields"); }
async function signup(language = "en") { await button(resources[language].translation.authForm.switchSignup); await until(() => !!document.getElementById("confirm-password"), "signup"); }
async function fill(password = "SyntheticPass123!") { await set("email", "synthetic@example.test"); await set("password", password); if (await evaluate(() => !!document.getElementById("confirm-password"))) await set("confirm-password", password); }
async function reflow() { assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "auth page reflow"); }
async function capture(name) { const file = "docs/forms-auth-" + name + ".png"; await screenshot(file); screenshots.push(file); }
try {
  await viewport(1280); await open("providers=loading");
  await until(() => document.body.innerText.includes("Loading sign-in options"), "provider loading"); assert.ok(await evaluate(() => !document.querySelector('button[type="submit"]').disabled));
  await config({ providers: "all" }); await evaluate(() => window.authFixture.resolveProviders()); await until(() => document.body.innerText.includes("Continue with Google"), "provider loaded");
  const languageOptions = await evaluate(() => [...document.getElementById("auth-language").options].map(option => ({ code: option.value, label: option.text, lang: option.lang })));
  assert.deepEqual(languageOptions.map(option => option.code), languages); assert.ok(languageOptions.every(option => option.label && option.lang === option.code));
  assert.equal(await evaluate(() => document.querySelector('label[for="auth-language"]').textContent), "Language");
  await button(messages.signIn); assert.equal((await writes()).length, 0); assert.equal(await evaluate(() => document.activeElement.id), "email");
  await open("providers=error"); await until(() => document.body.innerText.includes("Other sign-in options could not load"), "provider error"); await config({ providers: "none" }); await button(messages.retryOptions); await until(() => !document.body.innerText.includes("Retry sign-in options"), "provider retry"); assert.ok(!await evaluate(() => document.body.innerText.includes("Continue with")));
  checks.push("configured native language options/names, visible label, provider loading/error/retry/disabled options, email fallback and required email validation");

  for (const code of ["invitation_session_expired", "social_disabled", "google_disabled", "social_cancelled", "social_session_expired", "unknown"]) { await open("error=" + code + "&error_description=UNTRUSTED"); assert.ok(await evaluate(() => !!document.querySelector('[role="alert"]'))); assert.ok(!await evaluate(() => document.body.innerText.includes("UNTRUSTED"))); }
  await open("passwordUpdated=1"); assert.ok(await evaluate(() => document.body.innerText.includes("Password updated.")));
  checks.push("all existing callback error codes and password-updated receipt localized without reflecting error_description");

  await open(); await signup(); assert.equal(await evaluate(() => document.activeElement.tagName), "H1");
  await set("signup-type", "company"); await button("Continue with Google"); assert.equal((await writes()).length, 0); assert.equal(await evaluate(() => document.activeElement.id), "signup-company"); assert.equal(await evaluate(() => document.getElementById("signup-company").getAttribute("aria-describedby")), "signup-company-error");
  await set("signup-company", "  Synthetic Company  "); await config({ result: "error" }); await button("Continue with Google"); await until(() => document.body.innerText.includes("Unable to start sign-in"), "social start error"); assert.deepEqual((await writes()).at(-1), { path: "/api/auth/google", body: { companyName: "Synthetic Company", returnTo: "/" } }); assert.equal(await value("signup-company"), "  Synthetic Company  ");
  await config({ result: "success" }); await fill(); await set("first-name", "Synthetic"); await set("last-name", "User"); await set("confirm-password", "OtherPass123!"); const beforeMismatch = (await writes()).length; await button(messages.createAccount); assert.equal((await writes()).length, beforeMismatch); assert.equal(await evaluate(() => document.activeElement.id), "confirm-password"); assert.equal(await evaluate(() => document.getElementById("confirm-password").getAttribute("aria-describedby")), "confirm-password-error");
  await set("password", " SyntheticPass123! "); await set("confirm-password", "SyntheticPass123!"); await button(messages.createAccount); assert.equal((await writes()).length, beforeMismatch, "exact password spaces must match");
  await fill(" SyntheticPass123! "); await config({ result: "invalid" }); await button(messages.createAccount); await until(() => document.body.innerText.includes("Unable to create your account"), "rejected signup"); assert.equal(await value("first-name"), "Synthetic"); assert.equal(await value("email"), "synthetic@example.test"); assert.equal(await value("password"), " SyntheticPass123! ");
  await config({ result: "pending" }); await button(messages.createAccount); await until(() => !!window.authFixture.resolve, "pending signup"); const pending = (await writes()).length; await evaluate(() => document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); assert.equal((await writes()).length, pending);
  assert.ok(await evaluate(() => [...document.querySelectorAll('form input,form select,form button')].every(control => control.matches(":disabled"))));
  assert.deepEqual((await writes()).at(-1).body, { email: "synthetic@example.test", password: " SyntheticPass123! ", firstName: "Synthetic", lastName: "User", accountType: "company", companyName: "  Synthetic Company  ", returnTo: "/" });
  await config({ result: "success" }); await evaluate(() => window.authFixture.resolve()); await until(() => document.body.innerText.includes("Check your email to confirm"), "signup pending confirmation"); assert.equal(await value("password"), ""); assert.equal(await value("confirm-password"), ""); assert.equal(await value("email"), "synthetic@example.test");
  checks.push("company social validation/payload/failure retention; exact password confirmation; rejected signup retention; synchronous duplicate guard; unchanged credential payload and safe email-confirmation success with cleared secrets");

  await set("password", "UnsubmittedPass123!"); await set("confirm-password", "UnsubmittedPass123!"); await button(messages.switchSignIn); assert.equal(await value("password"), ""); assert.equal(await value("confirm-password"), undefined); assert.equal(await value("email"), "synthetic@example.test");
  await set("password", "SyntheticPass123!"); await config({ result: "unauthorized" }); await button(messages.signIn); await until(() => document.body.innerText.includes("Invalid email or password"), "invalid sign-in"); assert.ok(await evaluate(() => document.activeElement.getAttribute("role") === "alert"));
  await config({ result: "rateLimited" }); await button(messages.signIn); await until(() => document.body.innerText.includes("Too many login attempts"), "rate limit");
  await config({ result: "error" }); await button(messages.signIn); await until(() => document.body.innerText.includes("Sign-in could not be completed"), "safe generic failure"); assert.ok(!await evaluate(() => !!document.querySelector("img")));
  checks.push("mode switching clears secrets and retains email; credential-denial, rate-limit and safe generic errors focus inline feedback");

  await open("returnTo=%2Fmy-bookings"); await signup(); assert.ok(!await evaluate(() => !!document.getElementById("signup-type"))); await fill(); await config({ result: "pending" }); await button(messages.createAccount); await until(() => !!window.authFixture.resolve, "return-aware signup"); assert.equal((await writes()).at(-1).body.returnTo, "/my-bookings"); assert.equal((await writes()).at(-1).body.accountType, "personal"); await config({ result: "success" }); await evaluate(() => window.authFixture.resolve()); await until(() => document.body.innerText.includes("Check your email"), "return-aware success");
  await open("returnTo=https%3A%2F%2Fevil.example"); await fill(); await config({ result: "pending" }); await button(messages.signIn); await until(() => !!window.authFixture.resolve, "safe redirect login"); assert.equal((await writes()).at(-1).body.returnTo, "/"); await config({ result: "success" }); await evaluate(() => window.authFixture.resolve()); await until(() => location.pathname === "/", "safe local redirect");
  checks.push("allowed booking return remains personal signup; unapproved external return falls back to root after mocked login (static fixture navigation only)");

  await open("returnTo=" + encodeURIComponent("/invite?token=synthetic-reference")); await until(() => !!document.getElementById("invitation-recovery-email"), "invitation recovery"); await set("invitation-recovery-email", "invited@example.test"); await config({ result: "error" }); await button(messages.recoverySend); await until(() => document.body.innerText.includes("Unable to send a sign-in email"), "recovery rejection"); assert.equal(await value("invitation-recovery-email"), "invited@example.test");
  await config({ result: "pending" }); await button(messages.recoverySend); await until(() => !!window.authFixture.resolve, "recovery pending"); const recovering = (await writes()).length; await evaluate(() => document.querySelectorAll("form")[1].dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); assert.equal((await writes()).length, recovering);
  assert.deepEqual((await writes()).at(-1).body, { email: "invited@example.test", returnTo: "/invite?token=synthetic-reference" }); await config({ result: "success" }); await evaluate(() => window.authFixture.resolve()); await until(() => document.body.innerText.includes("If this address has an active invitation"), "non-enumerating recovery receipt");
  checks.push("invitation recovery existing endpoint/return path, failed-value retention, pending duplicate guard and non-enumerating localized receipt");

  await open(); await signup(); await set("first-name", "Synthetic العربية"); await set("last-name", "Example"); await fill();
  for (const language of languages) {
    await set("auth-language", language); await until(() => document.documentElement.lang === document.getElementById("auth-language").value, "auth language"); assert.equal(await value("first-name"), "Synthetic العربية"); assert.equal(await value("email"), "synthetic@example.test"); assert.equal(await value("password"), "SyntheticPass123!"); assert.equal(await evaluate(() => document.documentElement.dir), language === "ar" ? "rtl" : "ltr"); assert.ok(!await evaluate(() => document.body.innerText.includes("authForm.")));
    for (const width of [320, 390, 639, 640, 641, 768, 1280]) {
      await viewport(width); await reflow();
      assert.ok(await evaluate(width => { const first = document.getElementById("first-name").getBoundingClientRect(), last = document.getElementById("last-name").getBoundingClientRect(); return width < 640 ? last.top > first.bottom : Math.abs(last.top - first.top) < 1; }, width), "name field responsive grouping");
      matrix.push({ language, width });
    }
  }
  checks.push("77 locale/viewport cases: all 11 languages, Arabic document direction, native language choice, retained form values and one-column phone/two-column wider names");
  await set("auth-language", "en"); await viewport(1280); await set("password", ""); await set("confirm-password", ""); await evaluate(() => document.activeElement?.blur()); contrast.push({ view: "signup-light", ...await measureFormContrast(fixture, ".auth-form") }); assert.deepEqual(contrast.at(-1).failures, []); await capture("signup-desktop");
  await click("#fixture-theme"); contrast.push({ view: "signup-dark", ...await measureFormContrast(fixture, ".auth-form") }); assert.deepEqual(contrast.at(-1).failures, []); await set("auth-language", "ar"); await viewport(390); await capture("signup-arabic-dark");
  await open("returnTo=%2Finvite&lang=en"); await viewport(320); await reflow(); contrast.push({ view: "login-recovery-light", ...await measureFormContrast(fixture, ".auth-form") }); assert.deepEqual(contrast.at(-1).failures, []); await capture("login-phone");
  await click("#fixture-theme"); contrast.push({ view: "login-recovery-dark", ...await measureFormContrast(fixture, ".auth-form") }); assert.deepEqual(contrast.at(-1).failures, []);
  await open(); await signup(); await viewport(320); await evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow(); assert.ok(await evaluate(() => document.getElementById("email").clientWidth >= 160)); await evaluate(() => { document.documentElement.style.fontSize = ""; });
  await api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }); await evaluate(() => document.getElementById("auth-language").focus()); await key("Tab"); assert.ok(await evaluate(() => document.activeElement.matches("select,button,input,a"))); await evaluate(() => document.getElementById("auth-language").focus()); await key("ArrowDown"); await key("Enter"); assert.ok(await evaluate(() => document.documentElement.lang === document.getElementById("auth-language").value));
  checks.push("light/dark text/control contrast, 320px 200% text reflow, native language keyboard operation and reduced-motion preference");
  assert.deepEqual(await evaluate(() => window.authFixture.unexpected), []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  await writeFile(path.join(root, "docs/forms-auth-browser-evidence.json"), JSON.stringify({ date: "2026-10-20", browser: "Chrome 155 headless, isolated synthetic fixture", checks, matrix, messageCount: keys.length, contrast, screenshots, unexpectedNetwork: fixture.network, blockedNetwork: fixture.blocked, runtimeErrors: fixture.errors, limits: "No connected auth, app server, database, email, OAuth provider, session persistence or deployment. Other browsers, physical devices/keyboards, screen readers, native-language quality and actual 400% browser zoom remain unverified." }, null, 2) + "\n");
  console.log(`Passed auth: ${checks.length} groups, ${matrix.length} locale/viewport cases, ${keys.length} messages in 11 locales; zero unexpected requests/runtime exceptions.`);
} finally { await fixture.close(); }
