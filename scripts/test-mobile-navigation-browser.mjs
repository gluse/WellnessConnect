import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/mobile-navigation.tsx", resources });
const { evaluate, until, visit, viewport, click, key, set } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome";
const artifactPrefix = process.env.MOBILE_NAV_ARTIFACT_PREFIX || "mobile-navigation";
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
const checks = [], matrix = [], screenshots = [];
const bar = '[data-mobile-navigation]';
const burger = `${bar} button`;
const workspace = 'nav:not([data-mobile-navigation]) button[title]';
// Windows WebKit subtracts the app's 4px scrollbar from its CSS media viewport.
// Exercise the requested CSS widths, rather than the surrounding window width.
const cssViewport = async (width, height = 900) => {
  await viewport(width, height);
  const gutter = await evaluate(() => matchMedia(`(width: ${document.documentElement.clientWidth}px)`).matches ? innerWidth - document.documentElement.clientWidth : 0);
  if (gutter) await viewport(width + gutter, height);
};
const open = async (path = "/search", query = "") => {
  if (await evaluate(() => !!window.phase2Fixture)) assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  await visit(`${path}?${query}`);
  await until(() => !!document.querySelector("main"), "app content loaded");
};
const openMenu = async () => { await click(burger); await until(() => !!document.querySelector('[role="menu"]'), "burger menu opens"); await fixture.settle(); };
const selectMenu = async label => {
  await openMenu();
  await evaluate(label => [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === label).focus(), label);
  await key("Enter");
};
const openWorkspace = async () => { await selectMenu(resources.en.translation.providerNavigation.workspace); await until(() => !!document.querySelector("#mobile-workspace"), "workspace selector opens from Menu"); await fixture.settle(); };
const switchWorkspace = async value => { await openWorkspace(); await set("mobile-workspace", value); };
const checkWorkspace = async value => {
  await openWorkspace();
  assert.equal(await evaluate(() => document.querySelector('#mobile-workspace').value), value, "selector reflects active workspace");
  await key("Escape");
  await until(() => !document.querySelector('#mobile-workspace') && document.activeElement === document.querySelector('[data-mobile-navigation] button'), "workspace dismissal restores Menu focus");
};
try {
  for (const language of languages) {
    const labels = resources[language].translation;
    for (const width of [320, 545, 768, 1023, 1024, 1280]) {
      await cssViewport(width, 900); await open("/my-services/appointments", `lang=${language}`);
      await cssViewport(width, 900);
      await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "appointments rendered");
      const state = await evaluate(() => {
        const bar = document.querySelector('[data-mobile-navigation]');
        const headerLinks = [...document.querySelectorAll('header nav a')];
        const visible = element => !!element?.getBoundingClientRect().width;
        return { innerWidth, media: matchMedia('(min-width: 1024px)').matches, bar: visible(bar), top: headerLinks.every(visible),
          labels: [...bar.querySelectorAll('a span, button span')].map(node => node.textContent),
          account: !!bar.querySelector('a[href="/account"]'),
          targets: [...bar.querySelectorAll('a,button')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, clipped: node.scrollWidth > node.clientWidth + 1 }; }),
          providerLinks: [...document.querySelectorAll('nav a[href="/my-services/services"]')].filter(visible).length,
          desktopWorkspace: visible(document.querySelector('nav button[title]')),
          fits: document.documentElement.scrollWidth <= innerWidth + 1,
          clearance: parseFloat(getComputedStyle(bar.parentElement).paddingBottom) >= bar.getBoundingClientRect().height,
        };
      });
      assert.equal(state.bar, width < 1024, JSON.stringify({ language, width, state })); assert.equal(state.top, width >= 1024);
      assert.deepEqual(state.labels, [labels.mobileNavigation.explore, labels.nav.bookings, labels.appointmentAgenda.calendar, labels.mobileNavigation.menu]);
      assert.equal(state.account, false); assert.equal(state.fits, true);
      assert.equal(state.providerLinks, width >= 1024 ? 1 : 0);
      if (width < 1024) {
        assert.ok(state.targets.every(target => target.width >= 44 && target.height >= 44 && !target.clipped), JSON.stringify(state.targets));
        assert.equal(state.desktopWorkspace, false); assert.equal(state.clearance, true);
        await openMenu();
        assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map(node => node.textContent.trim())), [labels.providerNavigation.upcomingAppointments, labels.providerNavigation.pastAppointments, labels.mobileNavigation.services, labels.mobileNavigation.availability, labels.mobileNavigation.settings, labels.providerNavigation.workspace]);
        assert.equal(await evaluate(() => { const box = document.querySelector('[role="menu"]').getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= document.querySelector('[data-mobile-navigation]').getBoundingClientRect().top; }), true, "menu opens above bar within viewport");
        await key("Escape");
        await until(() => !document.querySelector('[role="menu"]') && document.activeElement === document.querySelector('[data-mobile-navigation] button'), "Escape restores focus");
        await selectMenu(labels.providerNavigation.workspace);
        await until(() => !!document.querySelector('#mobile-workspace'), "localized Workspace opens from Menu");
        await fixture.settle();
        const picker = await evaluate(() => {
          const field = document.querySelector('#mobile-workspace'), box = field.closest('[role="dialog"]').getBoundingClientRect();
          return { labelled: field.labels[0].textContent, options: field.options.length, focused: document.activeElement === field,
            fits: box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1 };
        });
        assert.equal(picker.labelled, labels.providerNavigation.workspace); assert.equal(picker.options, 3);
        assert.equal(picker.focused, true); assert.equal(picker.fits, true);
        if (width === 320 && language === 'en') {
          const file = `docs/${artifactPrefix}-${engine}-workspace.png`;
          await fixture.screenshot(file, false); screenshots.push(file);
        }
        await key('Escape');
        await until(() => !document.querySelector('#mobile-workspace') && document.activeElement === document.querySelector('[data-mobile-navigation] button'), "workspace Escape restores Menu focus");
      } else assert.equal(state.desktopWorkspace, true, "desktop workspace stays in sidebar");
      matrix.push({ language, width, windowWidth: state.innerWidth, height: 900 });
    }
  }
  checks.push("en/lv/ru: six widths, breakpoints, four labels, touch targets, mobile Workspace in Menu, localized dialog bounds/options/initial focus, Escape restoration and bar clearance; desktop Workspace retained");
  await cssViewport(545, 900); await open();
  await fixture.screenshot(`docs/${artifactPrefix}-${engine}-search.png`, false); screenshots.push(`docs/${artifactPrefix}-${engine}-search.png`);
  await evaluate(() => document.querySelector('[data-mobile-navigation] button').focus()); await key("Enter");
  await until(() => document.querySelector('[role="menu"]')?.contains(document.activeElement), "keyboard opening focuses menu");
  await key("ArrowDown");
  assert.equal(await evaluate(() => document.querySelector('[role="menu"]').contains(document.activeElement)), true);
  await key("Escape");
  await until(() => !document.querySelector('[role="menu"]'), "keyboard menu closes");
  await openMenu(); await click("main h2");
  await until(() => !document.querySelector('[role="menu"]'), "outside click dismisses menu");
  for (const [href, path] of [["/my-bookings", "/my-bookings"], ["/my-services/appointments", "/my-services/appointments"], ["/", "/"]]) {
    await click(`${bar} a[href="${href}"]`);
    await until(() => !!document.querySelector('[data-mobile-navigation] a[aria-current="page"]'), "active destination rendered");
    assert.equal(await evaluate(() => location.pathname), path);
    assert.equal(await evaluate(() => document.querySelectorAll('[data-mobile-navigation]').length), 1);
    assert.equal(await evaluate(() => document.querySelector('[data-mobile-navigation] a[aria-current="page"]').getAttribute("href")), href);
    assert.equal(await evaluate(() => document.querySelectorAll('nav[aria-label="Customer navigation"]').length), 0);
  }
  for (const [label, path] of [["Upcoming Appointments", "/my-services/upcoming-appointments"], ["Past & Cancelled Appointments", "/my-services/past-appointments"]]) {
    await selectMenu(label);
    await evaluate(path => { window.phase2Fixture.expectedPath = path; }, path);
    await until(() => location.pathname === window.phase2Fixture.expectedPath && !!document.querySelector('main h1'), "appointment list page loaded");
    assert.equal(await evaluate(() => location.pathname), path);
    assert.equal(await evaluate(() => document.querySelector('main h1').textContent), label);
    assert.equal(await evaluate(() => document.querySelector('[data-mobile-navigation] button').className.includes('text-primary')), true, "list destination highlights Menu");
    assert.equal(await evaluate(() => !!document.querySelector('[data-mobile-navigation] a[aria-current="page"]')), false);
  }
  await selectMenu(resources.en.translation.mobileNavigation.services);
  await until(() => location.pathname === "/my-services/services", "Services route");
  await selectMenu(resources.en.translation.mobileNavigation.availability);
  await until(() => location.pathname === "/my-services/availability", "Availability route");
  await selectMenu(resources.en.translation.mobileNavigation.settings);
  await until(() => location.pathname === "/my-services/settings", "Settings route");
  assert.equal(await evaluate(() => document.querySelector('[data-mobile-navigation] button').className.includes("text-primary")), true);
  assert.equal(await evaluate(() => document.querySelector('[role="menu"]')), null);
  await open("/my-services/settings/billing");
  assert.equal(await evaluate(() => document.querySelector('[data-mobile-navigation] button').className.includes("text-primary")), true, "nested tool route highlights Menu");
  await open("/account"); await until(() => !!document.querySelector("#account-name"), "Account loaded");
  assert.equal(await evaluate(() => document.querySelectorAll('[data-mobile-navigation]').length), 1);
  await click('header button[aria-label="Open account menu"]');
  await until(() => !!document.querySelector('[role="menu"] a[href="/account"]'), "top account menu remains available");
  await key("Escape");
  checks.push("all tabs and menu destinations, active and nested routes, Account coverage and sole top account control");

  await open("/my-services/appointments", "companies=0");
  assert.equal(await evaluate(() => [...document.querySelectorAll('nav button[title]')].length), 0, "personal-only selector hidden");
  await openMenu();
  assert.equal(await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === 'Workspace')), false);
  await key("Escape");
  await open("/my-services/appointments");
  await switchWorkspace("2");
  await until(() => document.querySelector('nav button[title]')?.title.startsWith("Synthetic company") && !document.querySelector('[data-mobile-navigation] button').disabled, "company switch completes");
  await checkWorkspace("2");
  assert.equal(await evaluate(() => document.querySelector('main').textContent.includes("Administrator")), false, "role not displayed above mobile content");
  await openWorkspace();
  assert.equal(await evaluate(() => document.querySelector('#mobile-workspace').selectedOptions[0].textContent.endsWith(' · Administrator')), true, "role retained in Workspace selection");
  await key('Escape'); await until(() => !document.querySelector('#mobile-workspace'), 'workspace closes');
  assert.equal(await evaluate(() => document.querySelectorAll("script").length), 1, "workspace name stays plain text");
  await switchWorkspace("personal");
  await until(() => document.querySelector('nav button[title]')?.title === "Personal workspace" && !document.querySelector('[data-mobile-navigation] button').disabled, "personal switch completes");
  await checkWorkspace("personal");
  await evaluate(() => { window.phase2Fixture.result = "error"; });
  await switchWorkspace("2");
  await until(() => document.body.textContent.includes("Unable to switch workspace"), "failed switch reported");
  await checkWorkspace("personal");
  await evaluate(() => document.querySelector('[toast-close]').focus()); await key("Enter");
  await until(() => !document.querySelector('[toast-close]'), "dismiss switch error toast before continuing");
  await evaluate(() => { window.phase2Fixture.result = "pending"; });
  await switchWorkspace("2");
  await until(() => document.querySelector('[data-mobile-navigation] button').disabled, "pending switch disables bar");
  await evaluate(() => document.querySelector('[data-mobile-navigation] a[href="/"]').focus()); await key("Enter");
  assert.equal(await evaluate(() => location.pathname), "/my-services/appointments");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 4, "no duplicate switch");
  await evaluate(() => { window.phase2Fixture.result = "success"; window.phase2Fixture.release(); });
  await until(() => !document.querySelector('[data-mobile-navigation] button').disabled, "switch settles");
  await switchWorkspace("3");
  await until(() => document.querySelector('nav button[title]')?.title === "Second synthetic company" && !document.querySelector('[data-mobile-navigation] button').disabled, "viewer switch completes");
  assert.equal(await evaluate(() => /Viewer|You can view appointments assigned to you/.test(document.querySelector('main').textContent)), false, "viewer role and role notice absent above content");
  await checkWorkspace("3");
  await openMenu();
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map(node => node.textContent.trim())), ["Upcoming Appointments", "Past & Cancelled Appointments", "Services", "Workspace"], "viewer keeps appointment lists and workspace but cannot access restricted tools");
  await key("Escape");
  checks.push("personal-only, company/personal/viewer switching; roles only in Workspace selection; failure retention and pending/duplicate/navigation protection");

  for (const context of ["pending", "error"]) {
    await open("/search", `context=${context}`); await openMenu();
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map(node => node.textContent.trim())), ["Upcoming Appointments", "Past & Cancelled Appointments", "Services"]);
    assert.equal(await evaluate(() => document.querySelector('[role="menu"] [role="status"]').textContent.trim()), resources.en.translation.mobileNavigation[context === "pending" ? "workspaceLoading" : "workspaceError"]);
    if (context === "pending") {
      await evaluate(() => { window.phase2Fixture.contextResult = "success"; window.phase2Fixture.releaseContext(); });
      await until(() => document.querySelectorAll('[role="menuitem"]').length === 6, "permissions load into menu");
    }
    await key("Escape");
  }
  checks.push("loading and failed permission reads withhold restricted links and show localized status");

  await open("/my-services/services/new"); await until(() => !!document.querySelector("#serviceName"), "editor loaded");
  await set("serviceName", "Synthetic unsaved draft");
  await selectMenu("Availability");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "menu exit confirms unsaved draft");
  await fixture.settle();
  assert.equal(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement)), true);
  assert.equal(await evaluate(() => document.querySelector('[role="menu"]')), null);
  await fixture.button(resources.en.translation.serviceForm.keepEditing);
  await until(() => !document.querySelector('[role="alertdialog"]'), "keep editing closes confirmation");
  await until(() => document.activeElement === document.querySelector('[data-mobile-navigation] button'), "menu trigger focus returns");
  assert.equal(await evaluate(() => document.querySelector("#serviceName").value), "Synthetic unsaved draft");
  await click(`${bar} a[href="/my-bookings"]`);
  await until(() => !!document.querySelector('[role="alertdialog"]'), "bottom tab exit confirms draft");
  await fixture.button(resources.en.translation.serviceForm.discard);
  await until(() => location.pathname === "/my-bookings", "confirmed tab leaves editor");
  await open("/my-services/services/new"); await until(() => !!document.querySelector("#serviceName"), "editor loaded again");
  await set("serviceName", "Workspace draft");
  await switchWorkspace("2");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "workspace exit confirms draft");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 0);
  await fixture.button(resources.en.translation.serviceForm.keepEditing);
  await until(() => !document.querySelector('[role="alertdialog"]'), "workspace cancellation");
  await until(() => document.activeElement === document.querySelector('[data-mobile-navigation] button'), "workspace focus returns to Menu");
  await switchWorkspace("2");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "workspace confirmation reopens");
  await fixture.button(resources.en.translation.serviceForm.discard);
  await until(() => location.pathname === "/my-services/services", "confirmed workspace exit completes");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), [{ companyId: 2 }]);
  await open("/my-services/services/new"); await until(() => !!document.querySelector("#serviceName"), "menu confirmation editor");
  await set("serviceName", "Menu discard draft"); await selectMenu("Availability");
  await until(() => !!document.querySelector('[role="alertdialog"]'), "menu confirmation reopens");
  await fixture.button(resources.en.translation.serviceForm.discard);
  await until(() => location.pathname === "/my-services/availability", "confirmed menu destination");
  checks.push("dirty editor menu/tab/workspace exits, confirmation focus, cancellation preserves drafts and confirmed exits happen once");

  await open("/search", "lang=ru");
  await evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await until(() => parseFloat(getComputedStyle(document.querySelector('[data-mobile-navigation]').parentElement).paddingBottom) >= document.querySelector('[data-mobile-navigation]').getBoundingClientRect().height, "200% text bar clearance");
  assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await openMenu(); await cssViewport(1024, 900);
  await until(() => !document.querySelector('[role="menu"]'), "resize to desktop closes mobile menu");
  await cssViewport(320, 700); await open("/my-services/appointments", "lang=ru");
  await openMenu(); await fixture.screenshot(`docs/${artifactPrefix}-${engine}-phone.png`, false); screenshots.push(`docs/${artifactPrefix}-${engine}-phone.png`);
  await key("Escape");
  await evaluate(() => window.phase2Fixture.signOut());
  await until(() => !document.querySelector('[data-mobile-navigation]'), "logout removes private navigation");
  await open("/search", "guest=1");
  await until(() => !!document.querySelector('nav[aria-label="Customer navigation"]'), "guest legacy navigation retained");
  assert.equal(await evaluate(() => document.querySelectorAll('[data-mobile-navigation]').length), 0);
  checks.push("200% text, desktop resize dismisses menu, logout removes signed-in bar, guest navigation unchanged");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/${artifactPrefix}-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, checks, matrix, screenshots, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual App with synthetic fetch mocks; no connected services/database/session writes. Physical devices, native-language review and screen readers unverified." }, null, 2) + "\n");
  console.log(`Passed mobile navigation ${engine}: ${checks.length} behavior groups, ${matrix.length} viewport/locale cases.`);
} finally { await fixture.close(); }
