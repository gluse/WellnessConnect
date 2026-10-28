import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/invite-password.tsx", resources });
const { visit, until, set, evaluate, button, viewport, key, screenshot } = fixture;
const writes = () => evaluate(() => window.phase2Fixture.writes);
try {
  await mkdir(new URL("../output/invite-password/", import.meta.url), { recursive: true });
  for (const language of ["en", "lv", "ru"]) {
    const messages = resources[language].translation.authForm;
    await visit(`/invite?lang=${language}`);
    await until(() => !!document.getElementById("invited-confirm-password"), "password setup");
    assert.equal(await evaluate(() => document.querySelector('label[for="invited-confirm-password"]').textContent), messages.confirmPassword);
    assert.ok(await evaluate(() => document.querySelector("button").disabled));
    await set("invited-password", "SyntheticPass123!");
    assert.ok(await evaluate(() => document.querySelector("button").disabled), "Confirmation is required");
    await set("invited-confirm-password", "SyntheticPass123! ");
    assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent), messages.passwordMismatch);
    assert.equal(await evaluate(() => document.getElementById("invited-confirm-password").getAttribute("aria-describedby")), "invited-confirm-password-error");
    assert.ok(await evaluate(() => document.querySelector("button").disabled), "Whitespace is significant");
    assert.deepEqual(await writes(), []);
    await set("invited-confirm-password", "SyntheticPass123!");
    await set("invited-password", "ChangedPass123!");
    assert.ok(await evaluate(() => document.querySelector("button").disabled), "Changing the original password revalidates confirmation");
    await set("invited-password", "SyntheticPass123!");
    assert.ok(await evaluate(() => !document.querySelector('[role="alert"]')));
    await evaluate(() => document.getElementById("invited-password").focus()); await key("Tab");
    assert.equal(await evaluate(() => document.activeElement.id), "invited-confirm-password");
    for (const width of [320, 768, 1280]) {
      await viewport(width);
      assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
    }
    await viewport(320); await evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "200% text reflow: " + JSON.stringify(await evaluate(() => [...document.querySelectorAll("main *")].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => ({ tag: element.tagName, text: element.textContent, width: element.clientWidth, scroll: element.scrollWidth })))));
    await evaluate(() => { document.documentElement.style.fontSize = ""; });
    await screenshot(`output/invite-password/${language}-320.png`);
    await evaluate(() => { window.phase2Fixture.rejectPassword = true; });
    await button("Accept Invitation");
    await until(() => document.body.innerText.includes("Synthetic password rejection"), "password rejection");
    assert.deepEqual(await writes(), [{ path: "/api/auth/invite-password", body: { password: "SyntheticPass123!" } }]);
    assert.equal(await evaluate(() => document.getElementById("invited-confirm-password").value), "SyntheticPass123!", "Retain confirmation after rejection");
    await evaluate(() => { window.phase2Fixture.rejectPassword = false; });
    await button("Accept Invitation");
    await until(() => document.body.innerText.includes("Synthetic acceptance rejection"), "acceptance attempted");
    assert.deepEqual((await writes()).slice(1), [{ path: "/api/auth/invite-password", body: { password: "SyntheticPass123!" } }, { path: "/api/company/invitations/accept", body: { id: "synthetic-invitation" } }]);
    assert.ok(await evaluate(() => !document.getElementById("invited-confirm-password")), "Hide setup after password saved");
  }
  await visit("/invite?password=set");
  await until(() => !document.querySelector("button").disabled, "existing account");
  assert.ok(await evaluate(() => !document.getElementById("invited-confirm-password")));
  await button("Accept Invitation");
  await until(() => document.body.innerText.includes("Synthetic acceptance rejection"), "existing account acceptance");
  assert.deepEqual(await writes(), [{ path: "/api/company/invitations/accept", body: { id: "synthetic-invitation" } }]);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  console.log("Passed invite password: en/lv/ru confirmation, exact matching, keyboard order, 320/768/1280px and 200% text reflow, rejection/retry, unchanged API payload and existing-account acceptance; no connected services.");
} finally { await fixture.close(); }
