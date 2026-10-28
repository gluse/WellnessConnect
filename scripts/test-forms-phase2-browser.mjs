import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";
import { serviceAmount } from "../client/src/components/forms-locale.ts";
import { languages, deferredLanguages, verificationDate, evidencePrefix } from "./fixtures/forms-verification-scope.mjs";
assert.equal(serviceAmount(0, "en"), "$0.00");
assert.equal(serviceAmount(1.005, "en"), "$1.00", "Preserve existing toFixed display rounding");
assert.equal(serviceAmount(2.675, "en"), "$2.67");
const root = path.resolve(import.meta.dirname, "..");
const prefix = evidencePrefix("phase2");
const resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
let messageCount = 0;
for (const namespace of ["accountForm", "passwordForm", "addressForm", "bookingForm"]) {
  const keys = Object.keys(resources.en.translation[namespace]); messageCount += keys.length;
  for (const language of languages) {
    assert.deepEqual(Object.keys(resources[language].translation[namespace]).sort(), [...keys].sort());
    for (const key of keys) {
      const value = resources[language].translation[namespace][key];
      assert.ok(typeof value === "string" && value.trim(), language + ":" + namespace + ":" + key);
      assert.deepEqual(value.match(/{{\w+}}/g)?.sort(), resources.en.translation[namespace][key].match(/{{\w+}}/g)?.sort(), language + ":" + key);
    }
  }
}
const fixture = await browserFixture({ entry: "scripts/fixtures/forms-phase2.tsx", resources });
const { api, evaluate, until, settle, click, button, set, visit, viewport, key, screenshot } = fixture;
const checks = [], matrix = [], screenshots = [], contrast = [];
try {
  const writes = prefix => evaluate(prefix => window.phase2Fixture.writes.filter(write => write.path.startsWith(prefix)), prefix);
  const configure = options => evaluate(options => Object.assign(window.phase2Fixture, options), options);
  const value = id => evaluate(id => document.getElementById(id)?.value, id);
  const account = async (language = "en", extra = "") => { await visit("/account?lang=" + language + extra); await until(() => !!document.getElementById("account-name"), "account form"); };
  const booking = async (language = "en", extra = "") => {
    await visit("/?mode=booking&lang=" + language + extra); await click("#open-booking button");
    await until(() => !!document.querySelector('[role="dialog"]'), "booking modal"); await settle();
  };
  const choose = async (language = "en") => {
    await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "available calendar date");
    await click('button[name="day"]:not([disabled])');
    await until(() => [...document.querySelectorAll('[aria-pressed]')].some(button => button.textContent.includes("10:00")), "available times");
    await click('button[aria-pressed="false"]');
    await button(resources[language].translation.bookingForm.continue);
    await until(() => !!document.getElementById("booking-notes"), "booking review");
  };
  const confirm = () => button("Request booking");
  const dialog = () => until(() => !!document.querySelector('[role="alertdialog"][data-state="open"]'), "confirmation");
  const modalClosed = () => until(() => !document.querySelector('[role="alertdialog"]'), "confirmation closed");
  const capture = async (name, full = true) => { const file = "docs/" + prefix + "-" + name + ".png"; await screenshot(file, full); screenshots.push(file); };
  const reflow = async () => {
    const bounds = await evaluate(() => {
      const modal = document.querySelector('[role="dialog"]') || document.querySelector('[role="alertdialog"]');
      return { page: document.documentElement.scrollWidth <= innerWidth + 1, modal: !modal || modal.scrollWidth <= modal.clientWidth + 1 };
    });
    assert.ok(bounds.page && bounds.modal, JSON.stringify(bounds));
  };
  await viewport(1280);
  await account();
  await set("account-name", "  Āna  "); await set("account-surname", "  O’Neil-Smith  "); await button("Save changes");
  await until(() => [...document.querySelectorAll('[role="status"]')].some(element => element.textContent === "Account details saved."), "profile success");
  assert.deepEqual((await writes("/api/auth/user")).at(-1).body, { firstName: "Āna", lastName: "O’Neil-Smith" });
  assert.equal((await writes("/api/auth/password")).length, 0);
  assert.equal((await writes("/api/addresses")).length, 0);
  await configure({ accountResult: "error" }); await set("account-name", "Retained name"); await button("Save changes");
  await until(() => document.querySelector('[role="alert"]')?.textContent.includes("try again"), "profile rejected");
  assert.equal(await value("account-name"), "Retained name");
  const beforeInvalid = (await writes("/api/auth/user")).length;
  await set("account-name", "x".repeat(101)); await button("Save changes");
  assert.equal((await writes("/api/auth/user")).length, beforeInvalid);
  assert.equal(await evaluate(() => document.activeElement.id), "account-name");
  assert.equal(await evaluate(() => document.getElementById("account-name").getAttribute("aria-describedby")), "account-name-error");
  await set("account-name", "Pending name"); await configure({ accountResult: "pending" }); await button("Save changes");
  await until(() => document.getElementById("account-name").disabled, "profile pending");
  const pendingProfile = (await writes("/api/auth/user")).length;
  await evaluate(() => document.getElementById("account-details-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal((await writes("/api/auth/user")).length, pendingProfile);
  assert.equal(await evaluate(() => document.querySelector('#account-password-form button[type="submit"]').disabled), false);
  await evaluate(() => window.phase2Fixture.resolve());
  await until(() => !document.getElementById("account-name").disabled, "profile settled");
  checks.push("Profile schema normalization, read-only details, independent saves, linked validation/focus, failed-save retention and pending duplicate protection.");

  const passwords = async (current = "SyntheticOld1!", next = "SyntheticNew2!", confirmValue = next) => {
    await set("account-current-password", current); await set("account-new-password", next); await set("account-confirm-password", confirmValue);
  };
  await passwords("SyntheticOld1!", "short"); await button("Update password");
  assert.equal((await writes("/api/auth/password")).length, 0);
  assert.equal(await evaluate(() => document.activeElement.id), "account-new-password");
  await passwords("SyntheticOld1!", "SyntheticNew2!", "Mismatch"); await button("Update password");
  assert.equal((await writes("/api/auth/password")).length, 0);
  assert.equal(await evaluate(() => document.activeElement.id), "account-confirm-password");
  await passwords(); await configure({ passwordResult: "wrong" }); await button("Update password");
  await until(() => document.getElementById("account-current-password-error")?.textContent.includes("incorrect"), "incorrect password");
  assert.equal(await value("account-new-password"), "SyntheticNew2!");
  await configure({ passwordResult: "html" }); await button("Update password");
  await until(() => [...document.querySelectorAll('[role="alert"]')].some(element => element.textContent.includes("Could not confirm")), "unexpected password response");
  await configure({ passwordResult: "pending" }); await button("Update password");
  await until(() => document.querySelector('#account-password-form fieldset').disabled, "password pending");
  const pendingPassword = (await writes("/api/auth/password")).length;
  await evaluate(() => document.getElementById("account-password-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal((await writes("/api/auth/password")).length, pendingPassword);
  await evaluate(() => window.phase2Fixture.resolve());
  await until(() => document.getElementById("account-new-password").value === "", "password clears on confirmed success");
  assert.deepEqual((await writes("/api/auth/password")).at(-1).body, { currentPassword: "SyntheticOld1!", newPassword: "SyntheticNew2!" });
  checks.push("Password validation/focus, wrong-password and invalid-response states, unchanged payload, pending duplicates and secret-field clearing on confirmed success.");

  await account();
  assert.equal(await evaluate(() => window.phase2Fixture.geocodes), 0);
  await button("Add address"); await set("address", "Synthetic new address");
  assert.equal(await evaluate(() => document.querySelector("details").open), false);
  await click("details summary");
  assert.equal(await evaluate(() => window.phase2Fixture.geocodes), 0);
  await set("latitude", "0"); await set("longitude", "0"); await button("Save address");
  await until(() => [...document.querySelectorAll('[role="status"]')].some(element => element.textContent === "Address saved."), "address saved");
  assert.equal(await evaluate(() => document.activeElement.dataset.addressId), "10");
  assert.equal((await writes("/api/addresses")).at(-1).body.latitude, 0);
  assert.equal((await writes("/api/addresses")).at(-1).body.longitude, 0);
  assert.equal(await evaluate(() => window.phase2Fixture.geocodes), 0);
  checks.push("Address manual disclosure causes no lookup; zero coordinates remain valid canonical values; saved-card focus and durable success feedback.");

  await button("Add address"); await set("address", "Unsaved synthetic address");
  const beforeCancel = (await writes("/api/addresses")).length;
  await button("Cancel"); await dialog(); await button("Keep editing"); await modalClosed();
  assert.equal(await value("address"), "Unsaved synthetic address");
  assert.equal(await evaluate(() => document.activeElement.textContent.trim()), "Cancel");
  await button("Cancel"); await dialog(); await button("Discard changes"); await modalClosed();
  assert.equal(await evaluate(() => !!document.getElementById("address")), false);
  assert.equal((await writes("/api/addresses")).length, beforeCancel);
  assert.equal(await evaluate(() => document.activeElement.textContent.trim()), "Add address");
  checks.push("Dirty address Cancel supports Keep editing/Discard without saving and restores action focus.");

  await button("Add address"); await set("address", "Synthetic verified address");
  await configure({ geocodeResult: "error" }); await click('[data-testid="button-verify-address"]');
  await until(() => [...document.querySelectorAll('[role="alert"]')].some(element => element.textContent.includes("Unable to verify")), "verification failure");
  assert.equal(await evaluate(() => document.querySelector("details").open), true);
  assert.equal((await writes("/api/addresses")).length, beforeCancel);
  await configure({ geocodeResult: "pending" }); await click('[data-testid="button-verify-address"]');
  await until(() => document.querySelector('#addresses button[type="submit"]').disabled, "verification pending blocks save");
  await set("address", "Changed while verifying address");
  await until(() => !document.querySelector('#addresses button[type="submit"]').disabled, "address edit cancels lookup");
  await evaluate(() => window.phase2Fixture.resolve());
  assert.equal(await value("latitude"), "");
  await configure({ geocodeResult: "success" }); await click('[data-testid="button-verify-address"]');
  await until(() => document.getElementById("address-status").textContent === "Location set", "persistent verification feedback");
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-verify-address"]').disabled), true);
  await configure({ addressResult: "error" }); await button("Save address");
  await until(() => [...document.querySelectorAll('[role="alert"]')].some(element => element.textContent.includes("Unable to save this address")), "address save rejected");
  assert.equal(await value("address"), "Changed while verifying address");
  assert.equal(await value("latitude"), "56.95");
  await configure({ addressResult: "pending" }); await button("Save address");
  await until(() => document.querySelector('#addresses button[type="submit"]').disabled, "address save pending");
  const pendingAddress = (await writes("/api/addresses")).length;
  await evaluate(() => document.querySelector('#addresses form').dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal((await writes("/api/addresses")).length, pendingAddress);
  await evaluate(() => window.phase2Fixture.resolve());
  await until(() => !document.getElementById("address"), "verified address saved");
  const savedAddress = (await writes("/api/addresses")).at(-1).body;
  assert.equal(savedAddress.locationSource, "google"); assert.equal(savedAddress.locationKey, "synthetic-key");
  assert.equal(savedAddress.latitude, 56.95); assert.equal(savedAddress.longitude, 24.1);
  checks.push("Verification failure/manual alternative, explicit retry, cancelled stale response, pending save guard, persistent location/expiry status and rejected-save retention.");

  await evaluate(() => [...document.querySelectorAll('[data-address-id="3"] button')].find(button => button.textContent === "Edit").click());
  assert.equal(await evaluate(() => document.querySelector("details").open), true);
  assert.ok(await evaluate(() => document.querySelector("#addresses").textContent.includes("every service")));
  await button("Cancel");
  await evaluate(() => [...document.querySelectorAll('[data-address-id="4"] button')].find(button => button.textContent === "Edit").click());
  await button("Save address");
  await until(() => document.querySelector("details").open, "coordinate error opens manual alternative");
  assert.equal(await evaluate(() => document.getElementById("latitude").getAttribute("aria-invalid")), "true");
  await button("Cancel");
  await evaluate(() => [...document.querySelectorAll('[data-address-id="3"] button')].find(button => button.textContent === "Remove").click());
  await dialog();
  assert.equal(await evaluate(() => document.querySelector('[role="alertdialog"] bdi').textContent), "Synthetic saved address");
  await button("Remove");
  await until(() => document.querySelector('[role="alertdialog"] [role="alert"]')?.textContent.includes("Unable to remove"), "used address rejection");
  await button("Cancel"); await modalClosed();
  assert.ok(await evaluate(() => !!document.querySelector('[data-address-id="3"]')));
  await configure({ removeResult: "success" });
  await evaluate(() => [...document.querySelectorAll('[data-address-id="3"] button')].find(button => button.textContent === "Remove").click());
  await dialog(); await button("Remove"); await modalClosed();
  assert.equal(await evaluate(() => !!document.querySelector('[data-address-id="3"]')), false);
  assert.equal(await evaluate(() => document.activeElement.textContent.trim()), "Add address");
  checks.push("Existing manual/expired addresses, shared-service warning, coordinate errors and named removal rejection/success preserve boundaries and focus.");

  await account("en", "&denied=true");
  assert.equal(await evaluate(() => [...document.querySelectorAll("button")].some(button => button.textContent === "Add address")), false);
  assert.ok(await evaluate(() => document.getElementById("addresses").textContent.includes("Only workspace managers")));
  checks.push("Address permission gate hides write controls.");

  await booking("en", "&guest=true&trigger=card");
  assert.ok(await evaluate(() => !!document.querySelector('[data-testid="dialog-booking-sign-in"]')));
  assert.equal((await writes("/api/bookings")).length, 0);
  await button("Continue browsing"); await until(() => !document.querySelector('[role="dialog"]'), "guest close");
  await until(() => document.activeElement === document.querySelector("#open-booking button"), "guest close restores trigger focus");
  checks.push("Actual service-card pointer trigger, guest booking sign-in gate and intentional close-focus restoration.");

  for (const state of ["pending", "empty", "error"]) {
    await booking("en", "&availability=" + state);
    if (state === "pending") assert.ok(await evaluate(() => [...document.querySelectorAll('[role="status"]')].some(element => element.textContent.includes("Checking availability"))));
    if (state === "empty") await until(() => document.querySelector('[role="dialog"]').textContent.includes("No openings this month"), "availability empty");
    if (state === "error") {
      await until(() => document.querySelector('[role="dialog"] [role="alert"]')?.textContent.includes("Unable to load available dates"), "availability error");
      await configure({ availabilityResult: "success" }); await button("Try again");
      await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "availability retry");
    }
    assert.equal((await writes("/api/bookings")).length, 0);
    await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "close while loading availability");
  }
  checks.push("Availability loading, empty and error/retry states remain actionable and never create a booking.");

  await booking(); await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "keyboard date ready");
  await evaluate(() => document.querySelector('button[name="day"]:not([disabled])').focus());
  await key("ArrowRight"); assert.equal(await evaluate(() => document.activeElement.textContent), "17");
  await key("Enter");
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "keyboard date selects times");
  await set("booking-timezone", "Europe/Riga");
  await until(() => !document.querySelector('button[aria-pressed]'), "timezone resets prior selection");
  await click('button[name="day"]:not([disabled])');
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "zoned slots ready");
  await click('button[aria-pressed="false"]'); await button("Continue");
  assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').textContent.includes("Europe/Riga") && document.querySelector('[role="dialog"]').textContent.includes("12:00")));
  assert.equal((await writes("/api/bookings")).length, 0);
  checks.push("Calendar arrow/Enter navigation and timezone changes retain canonical slot selection with an explicit appointment timezone.");

  await booking(); await choose();
  assert.equal(await evaluate(() => document.activeElement.tagName), "H2");
  await set("booking-participants", "0"); await confirm();
  assert.equal((await writes("/api/bookings")).length, 0);
  assert.equal(await evaluate(() => document.activeElement.id), "booking-participants");
  assert.equal(await evaluate(() => document.getElementById("booking-participants").getAttribute("aria-invalid")), "true");
  await set("booking-participants", "2"); await set("booking-notes", "Synthetic note");
  await button("Back"); await button("Continue");
  assert.equal(await value("booking-participants"), "2"); assert.equal(await value("booking-notes"), "Synthetic note");
  assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').textContent.includes("Payment collection is not available")));
  await configure({ bookingResult: "error" }); await confirm();
  await until(() => [...document.querySelectorAll('[role="alert"]')].some(element => element.textContent.includes("Unable to book")), "booking rejection");
  assert.equal(await value("booking-notes"), "Synthetic note");
  assert.equal(await evaluate(() => document.querySelectorAll('[role="alert"] img').length), 0);
  await configure({ bookingResult: "forbidden" }); await confirm();
  await until(() => [...document.querySelectorAll('[role="alert"]')].some(element => element.textContent.includes("permission")), "booking permission rejection");
  await configure({ bookingResult: "conflict" }); await confirm();
  await until(() => !document.getElementById("booking-notes") && [...document.querySelectorAll('[role="alert"]')].some(element => element.textContent.includes("no longer available")), "slot conflict returns to selection");
  await choose();
  assert.equal(await value("booking-participants"), "2"); assert.equal(await value("booking-notes"), "Synthetic note");
  await configure({ bookingResult: "pending" }); await confirm();
  await until(() => document.querySelector('[role="dialog"] button:last-child').disabled, "pending booking close disabled");
  const pendingBooking = (await writes("/api/bookings")).length;
  await evaluate(() => { const action = [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === "Request booking"); if (!action?.disabled) throw Error("Pending booking action must be disabled"); action.click(); }); assert.equal((await writes("/api/bookings")).length, pendingBooking);
  await key("Escape"); assert.ok(await evaluate(() => !!document.querySelector('[role="dialog"]')));
  await evaluate(() => window.phase2Fixture.resolve());
  await until(() => [...document.querySelectorAll('[role="dialog"] h2')].some(element => element.textContent === "Request sent"), "request success");
  assert.equal(await evaluate(() => document.activeElement.textContent), "Request sent");
  assert.ok(await evaluate(() => !document.querySelector('[role="dialog"]').textContent.includes("Booking confirmed")));
  assert.deepEqual((await writes("/api/bookings")).at(-1).body, { serviceId: 7, scheduledDate: "2030-01-16T10:00:00.000Z", participantCount: 2, notes: "Synthetic note" });
  await button("Close"); await until(() => !document.querySelector('[role="dialog"]'), "booking success close");
  assert.ok(await evaluate(() => document.activeElement === document.querySelector("#open-booking button")));
  checks.push("Booking participant errors, Back retention, safe rejected/denied feedback, slot-conflict recovery, pending duplicate/Escape guards, request-specific confirmation and unchanged payload.");

  await booking("en", "&instant=true"); await choose(); await button(resources.en.translation.booking.confirmBooking);
  await until(() => [...document.querySelectorAll('[role="dialog"] h2')].some(element => element.textContent === "Booking confirmed"), "instant booking confirmed");
  checks.push("Instant bookings show confirmation only after server success.");

  for (const language of languages) {
    await account(language);
    await set("account-name", "Synthetic العربية 123");
    await button(resources[language].translation.addressForm.add);
    await set("address", "Synthetic street address");
    await click("details summary");
    for (const width of [320, 390, 639, 640, 641, 768, 1280]) { await viewport(width); await reflow(); matrix.push("account:" + language + ":" + width); }
    await set("fixture-language", "en");
    await until(() => document.documentElement.lang === "en", "account language switch");
    assert.equal(await value("account-name"), "Synthetic العربية 123"); assert.equal(await value("address"), "Synthetic street address");
    await viewport(1280); await booking(language);
    await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "localized available dates");
    for (const width of [320, 390, 639, 640, 641, 768, 1280]) { await viewport(width); await reflow(); matrix.push("booking-selection:" + language + ":" + width); }
    await choose(language);
    await set("booking-notes", "Synthetic العربية notes");
    for (const width of [320, 390, 639, 640, 641, 768, 1280]) { await viewport(width); await reflow(); matrix.push("booking:" + language + ":" + width); }
    assert.equal(await evaluate(() => document.documentElement.dir), "ltr");
    await set("fixture-language", "en");
    await until(() => document.documentElement.lang === "en", "booking language switch");
    assert.equal(await value("booking-notes"), "Synthetic العربية notes");
  }
  checks.push("en/lv/ru and breakpoint edges: profile/address and booking review reflow; live language switching retains edits.");

  await viewport(1280); await account();
  const accountLight = await measureFormContrast(fixture); assert.deepEqual(accountLight.failures, []); contrast.push({ view: "account-light", ...accountLight });
  await capture("account-desktop");
  await viewport(390); await button("Add address"); await set("address", "Synthetic address for review"); await capture("address-phone");
  await booking("ru"); await choose("ru");
  await evaluate(() => document.documentElement.classList.add("dark"));
  const bookingDark = await measureFormContrast(fixture); assert.deepEqual(bookingDark.failures, []); contrast.push({ view: "booking-russian-dark", ...bookingDark });
  await api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await capture("booking-russian-dark", false);
  assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)));
  for (let index = 0; index < 8; index++) { await key("Tab"); assert.ok(await evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))); }
  await evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await viewport(320); await reflow();
  assert.ok(await evaluate(() => { const box = document.querySelector('[role="dialog"]').getBoundingClientRect(); return box.top >= 0 && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; }));
  await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "Escape booking close");
  checks.push("Rendered screenshots reviewed separately; dark/reduced-motion mode, keyboard containment/Escape and 200% text at 320px.");

  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.network, []);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  const evidence = { date: verificationDate, browser: await api("Browser.getVersion"), languages, deferredLanguages, checks, matrix, messageCount, contrast, screenshots, unexpectedRequests: fixture.network, blockedRequests: fixture.blocked, runtimeErrors: fixture.errors, limitations: ["Physical devices, real virtual keyboards, screen readers and actual 400% browser zoom are outside this runner.", "Translations need native-language review.", "No connected APIs, sessions, database writes, real geocoding or payment collection."] };
  await writeFile(path.join(root, "docs/" + prefix + "-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log("Passed Phase 2: " + checks.length + " interaction groups, " + matrix.length + " locale/width cases, " + messageCount + " translated keys; zero unexpected requests/runtime exceptions.");
} finally { await fixture.close(); }
