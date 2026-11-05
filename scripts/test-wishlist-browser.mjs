import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

// Real components and query behavior; synthetic fetch/auth/persistence only.
const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const nativeZoom = process.env.WISHLIST_NATIVE_ZOOM === "4";
const fixture = await browserFixture({ entry: "scripts/fixtures/wishlist.tsx", resources, ...(nativeZoom ? { nativeZoom: 4 } : {}) });
const { evaluate, until, visit, viewport, click, key, button } = fixture;
const first = '[data-fixture-cards] [data-wishlist-heart="7"]';
const duplicate = '[data-fixture-duplicate] [data-wishlist-heart="7"]';
const waitHeart = async () => until(() => !!document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]:not(:disabled)'), "heart membership ready");
const state = () => evaluate(() => [...document.querySelectorAll('[data-wishlist-heart="7"]')].map(node => node.getAttribute("aria-pressed")));
const assertClean = async () => { assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []); };
const checkHeader = async () => {
  const layout = await evaluate(() => {
    const brand = document.querySelector('.app-header-brand').getBoundingClientRect();
    const actions = document.querySelector('.app-header-actions').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.app-header-actions .header-icon-button')].filter(node => node.getClientRects().length);
    const sizes = buttons.map(node => { const box = node.getBoundingClientRect(), svg = node.querySelector('svg')?.getBoundingClientRect(); return { width: box.width, height: box.height, top: box.top, iconWidth: svg?.width, iconHeight: svg?.height }; });
    return { sameLine: Math.abs((brand.top + brand.height / 2) - (actions.top + actions.height / 2)) <= 1,
      separated: brand.right <= actions.left + 1, fits: document.documentElement.scrollWidth <= innerWidth + 1,
      targets: sizes.every(size => size.width >= 44 && size.height >= 44), icons: sizes.every(size => size.iconWidth === 20 && size.iconHeight === 20),
      aligned: sizes.every(size => Math.abs(size.top - sizes[0].top) <= 1), count: sizes.length };
  });
  assert.ok(layout.count >= 2, JSON.stringify(layout));
  assert.deepEqual({ ...layout, count: 0 }, { sameLine: true, separated: true, fits: true, targets: true, icons: true, aligned: true, count: 0 });
};
const evidence = { languages, browsers: [], viewportCases: [], checks: [] };
try {
  if (nativeZoom) {
    for (const language of languages) {
      await visit(`/gallery?lang=${language}`); await waitHeart();
      const zoom = await evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, fits: document.documentElement.scrollWidth <= innerWidth + 1, cssZoom: getComputedStyle(document.documentElement).zoom, scale: visualViewport.scale }));
      assert.ok(zoom.width >= 300 && zoom.width <= 330, JSON.stringify(zoom));
      assert.equal(zoom.dpr, 4); assert.equal(zoom.fits, true); assert.equal(zoom.cssZoom, "1"); assert.equal(zoom.scale, 1);
      await checkHeader();
      await click('[data-inbox-trigger="messages"]');
      await until(() => !!document.querySelector('[data-inbox-list="messages"]'), "zoom message panel");
      assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await key("Escape");
      await until(() => document.activeElement?.getAttribute('data-inbox-trigger') === 'messages', "zoom focus restores");
      const contrast = await measureFormContrast(fixture, "[data-fixture-cards]"); assert.deepEqual(contrast.failures, []);
      evidence.viewportCases.push({ language, ...zoom }); await assertClean();
      for (const route of ["/wishlist?seed=true", "/inbox?scope=customer"]) {
        await visit(`${route}&lang=${language}`);
        await until(() => !!document.querySelector("main h1"), "zoom wishlist/inbox content");
        assert.deepEqual(await evaluate(() => ({ position: getComputedStyle(document.querySelector("header")).position, fits: document.documentElement.scrollWidth <= innerWidth + 1 })), { position: "static", fits: true });
        evidence.viewportCases.push({ language, route, headerPosition: "static", reflow: true }); await assertClean();
      }
    }
    evidence.checks.push("native Chrome400% zoom (DPR4, CSSzoom1, viewport scale1), en/lv/ru reflow, header message operation/focus and text contrast; wishlist/inbox static header in short viewport");
    if (process.env.WISHLIST_SCREENSHOT) await fixture.screenshot(process.env.WISHLIST_SCREENSHOT, false);
  } else {
  await viewport(375, 800); await visit('/my-services/appointments?scopeBadges=true');
  await until(() => document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]')?.textContent === '5' && document.querySelector('[data-inbox-trigger="notifications"] [data-inbox-badge]')?.textContent === '4', 'global counts include default-seeker provider and customer messages');
  for (const route of ['/search', '/wishlist', '/account', '/my-bookings', '/my-services/appointments', '/inbox']) {
    await evaluate(route => window.phase2Fixture.navigate(route), route);
    await until(() => location.pathname !== '/gallery' && document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]')?.textContent === '5' && document.querySelector('[data-inbox-trigger="notifications"] [data-inbox-badge]')?.textContent === '4', 'badges stay global while navigating');
  }
  assert.equal(await evaluate(() => window.phase2Fixture.reads.filter(path => path.startsWith('/api/inbox/summary?')).every(path => new URL(path, location.origin).searchParams.get('scope') === 'all')), true, 'header never swaps to route-selected scope');
  await click('[data-inbox-trigger="messages"]');
  await until(() => document.querySelectorAll('[data-inbox-list="messages"] a[href*="booking="]').length >= 2, 'global popup lists both message roles');
  const targets = await evaluate(() => [...document.querySelectorAll('[data-inbox-list="messages"] a[href*="booking="]')].map(node => node.getAttribute('href')));
  assert.ok(targets.some(path => path.includes('scope=customer') && path.includes('booking=31')));
  assert.ok(targets.some(path => path.includes('scope=provider') && path.includes('booking=32')));
  await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'global popup closes');
  await evaluate(() => window.phase2Fixture.workspace(2));
  await until(() => document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]')?.textContent === '8' && document.querySelector('[data-inbox-trigger="notifications"] [data-inbox-badge]')?.textContent === '7', 'selected workspace refreshes global badge');
  await click('[data-inbox-trigger="messages"]');
  await until(() => !!document.querySelector('[data-inbox-list="messages"] a[href*="booking=32"][href*="companyId=2"]'), 'company row retains explicit workspace authorization link');
  await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'));
  await evaluate(() => window.phase2Fixture.setUser('other'));
  await until(() => !document.querySelector('[data-inbox-badge]'), 'account switch cannot retain global private counts');
  await assertClean();
  await visit('/inbox?scope=all&booking=31');
  await until(() => !!document.querySelector('main [role="alert"]'), 'mixed all-scope booking target rejected safely');
  assert.equal(await evaluate(() => window.phase2Fixture.reads.some(path => path.startsWith('/api/inbox/messages/31'))), false);
  evidence.checks.push('global header badges persist across appointments/search/wishlist/account/customer bookings/inbox for default-seeker owner; popup both roles, selected-workspace refresh, explicit target scopes and account isolation');
  for (const language of languages) {
    await viewport(1280, 900); await visit(`/gallery?lang=${language}`); await waitHeart();
    assert.deepEqual(await state(), ["false", "false"]);
    assert.equal(await evaluate(() => !!document.querySelector('[data-fixture-preview] [data-wishlist-heart]')), false, "unpublished preview has no wishlist action");
    assert.equal(await evaluate(() => !!document.querySelector('button button')), false, "heart is not nested inside image button");
    const membership = await evaluate(() => window.phase2Fixture.reads.filter(path => path.startsWith('/api/wishlist/membership')));
    assert.ok(membership.length <= 2, "visible hearts use bounded batched membership rather than one request per card");
    assert.ok(membership.some(path => path.includes("7,8")), "batch contains both visible services");
    await click(first); await until(() => document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]')?.getAttribute("aria-pressed") === "true" && !document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]').disabled, "saved heart");
    assert.deepEqual(await state(), ["true", "true"], "duplicate cards synchronize");
    assert.deepEqual(await evaluate(() => ({ details: window.phase2Fixture.details, books: window.phase2Fixture.books, writes: window.phase2Fixture.writes.map(({ method, path }) => method + ' ' + path) })), { details: 0, books: 0, writes: ["PUT /api/wishlist/services/7"] });
    await evaluate(selector => document.querySelector(selector).focus(), first); await key("Enter");
    await until(() => document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]')?.getAttribute("aria-pressed") === "false" && !document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]').disabled, "keyboard removal");
    assert.deepEqual(await state(), ["false", "false"]);
    for (const [width, height] of [[1280, 900], [1024, 900], [1023, 900], [768, 900], [640, 900], [639, 900], [375, 700], [320, 700], [390, 300]]) {
      await viewport(width, height);
      await checkHeader();
      const layout = await evaluate(() => {
        const heart = document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]');
        const box = heart.getBoundingClientRect();
        const glyph = heart.querySelector('svg').getBoundingClientRect();
        const art = heart.closest('.search-service-card').querySelector('.search-service-art').getBoundingClientRect();
        return { fits: document.documentElement.scrollWidth <= innerWidth + 1, target: box.width >= 44 && box.height >= 44, upperRight: box.right <= art.right + 1 && box.top >= art.top - 1 && box.top < art.top + 25,
          glyphAtCorner: Math.abs(art.right - glyph.right - 2) <= 1 && Math.abs(glyph.top - art.top - 2) <= 1 && glyph.width === 18 && glyph.height === 18, name: !!heart.getAttribute('aria-label') };
      });
      assert.deepEqual(layout, { fits: true, target: true, upperRight: true, glyphAtCorner: true, name: true });
      evidence.viewportCases.push({ language, width, height });
    }
    await assertClean();
  }
  evidence.checks.push("en/lv/ru hearts and one-line brand/header controls, consistent20px icons/44px targets at27 viewport cases including breakpoints; batching, duplicate instances, pointer/keyboard and no details/booking/view side effects");

  await viewport(375, 850); await visit("/gallery"); await waitHeart();
  await evaluate(() => { window.phase2Fixture.failSave = true; }); await click(first);
  await until(() => !!document.querySelector('[role="alert"]'), "failed save visible");
  assert.deepEqual(await state(), ["false", "false"], "failed optimistic save is restored");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 1, "failure has no automatic mutation retry");
  await click(first); await until(() => document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]')?.getAttribute("aria-pressed") === "true" && !document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]').disabled, "manual retry succeeds");
  await evaluate(() => { window.phase2Fixture.holdSave = true; }); await click(first);
  await until(() => !!document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]:disabled'), "pending disables duplicate input");
  await evaluate(selector => { document.querySelector(selector).click(); document.querySelector(selector).click(); }, duplicate);
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 3);
  await evaluate(() => window.phase2Fixture.setUser("other")); await waitHeart();
  assert.deepEqual(await state(), ["false", "false"], "new account has no previous wishlist flash");
  await evaluate(() => window.phase2Fixture.releaseSave());
  await until(() => !document.querySelector('[data-fixture-cards] [data-wishlist-heart="7"]').disabled);
  assert.deepEqual(await state(), ["false", "false"], "late old-account save cannot update current account");
  evidence.checks.push("failed-save rollback/manual retry, pending duplicate prevention, account change and late result isolation");

  await visit("/gallery?guest=true"); await waitHeart(); await click(first);
  await until(() => !!document.querySelector('[role="dialog"] a[href^="/login?"]'), "guest sign-in prompt");
  assert.equal(await evaluate(() => new URLSearchParams(new URL(document.querySelector('[role="dialog"] a').href).search).get('returnTo')), "/search?service=7");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 0);
  await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "guest prompt closes");
  await until(() => document.activeElement?.getAttribute("data-wishlist-heart") === "7", "guest prompt restores heart focus");
  await click(first); await click('[role="dialog"] a[href^="/login?"]'); await until(() => !!document.getElementById("fixture-login") && !document.querySelector('[role="dialog"]'), "login destination and prompt transition closed");
  await click("#fixture-login");
  await until(() => !!document.querySelector('[data-testid="dialog-service-details"] [data-wishlist-heart="7"]:not(:disabled)'), "read-only return opens selected service");
  await fixture.settle();
  assert.equal(await evaluate(() => {
    const button = document.querySelector('[data-testid="dialog-service-details"] [data-wishlist-heart="7"]');
    const glyph = button.querySelector('svg').getBoundingClientRect(), image = button.closest('.wishlist-control').parentElement.querySelector('img').getBoundingClientRect(), target = button.getBoundingClientRect();
    return image.width > 200 && Math.abs(image.right - glyph.right - 2) <= 1 && Math.abs(glyph.top - image.top - 2) <= 1 && target.width >= 44 && target.height >= 44;
  }), true, 'larger details photo keeps glyph at corner and transparent target inside');
  assert.equal(await evaluate(() => location.pathname + location.search), "/search?service=7");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 0, "auth return neither saves nor records a view");
  await click('[data-testid="dialog-service-details"] [data-wishlist-heart="7"]');
  await until(() => document.querySelector('[data-testid="dialog-service-details"] [data-wishlist-heart="7"]')?.getAttribute("aria-pressed") === "true", "guest manually saves after sign-in");
  await assertClean();
  evidence.checks.push("guest dialog, focus restore, exact login return, no automatic save/view, manual save after sign-in");

  for (const language of languages) {
    for (const route of ['/gallery', '/search']) {
      await viewport(320, 800); await visit(`${route}?guest=true&lang=${language}`);
      await until(() => !!document.querySelector('.app-header-actions a[href^="/login"]'), 'guest header ready');
      await checkHeader();
    }
  }
  evidence.checks.push('en/lv/ru signed-out general/search headers retain browse/login actions in one line at320px');

  for (const language of languages) {
    await viewport(320, 800); await visit(`/wishlist?seed=true&lang=${language}`);
    await until(() => !!document.querySelector('[data-wishlist-unavailable="99"] [data-wishlist-heart]:not(:disabled)'), "seeded wishlist and unavailable entry");
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await evaluate(() => document.querySelector('[data-wishlist-unavailable="99"] [data-wishlist-heart]').getAttribute('aria-pressed')), "true");
    await click('[data-wishlist-unavailable="99"] [data-wishlist-heart]');
    await until(() => !document.querySelector('[data-wishlist-unavailable="99"]'), "unavailable item safely removed");
    await until(() => document.activeElement?.getAttribute('data-wishlist-heart') === '7' || document.activeElement === document.querySelector('[data-wishlist-page] h1'), "removal focuses next saved heart or heading during membership refresh");
    await click('[data-wishlist-page] [data-wishlist-heart="7"]');
    await until(() => !document.querySelector('[data-wishlist-page] [data-wishlist-heart]'), "last saved item removed");
    await until(() => document.activeElement === document.querySelector('[data-wishlist-page] h1'), "last removal focuses wishlist heading");
    assert.ok(await evaluate(() => !!document.querySelector('[data-wishlist-page] a[href="/search"]')), "empty state has browse link");
    await assertClean();
  }
  evidence.checks.push("en/lv/ru wishlist page, retained unavailable entries, safe removal, empty state and 320px reflow");

  await visit("/gallery"); await waitHeart();
  await evaluate(() => { window.phase2Fixture.failList = true; }); await click("#fixture-wishlist-link");
  await until(() => !!document.querySelector('[data-wishlist-page] [role="alert"]'), "list error");
  await evaluate(() => { window.phase2Fixture.failList = false; }); await button(resources.en.translation.wishlist.retry);
  await until(() => !!document.querySelector('[data-wishlist-page] a[href="/search"]'), "list retry empty");
  evidence.checks.push("wishlist read error and manual retry");

  for (const language of languages) {
    await viewport(320, 800); await visit(`/gallery?lang=${language}`); await waitHeart();
    await until(() => document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]')?.textContent === "1", "real header count");
    assert.equal(await evaluate(() => document.querySelector('[data-inbox-trigger="messages"]').getBoundingClientRect().width >= 44), true);
    await evaluate(() => document.querySelector('[data-inbox-trigger="messages"]').focus()); await key("Enter");
    await until(() => !!document.querySelector('[data-inbox-list="messages"] a[href*="booking=31"]'), "keyboard message panel");
    await fixture.settle();
    assert.equal(await evaluate(() => document.body.textContent.includes("Private message only in conversation")), false, "header never previews private message bodies");
    assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 0, "opening panel does not mark messages read");
    await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "message panel closes");
    await until(() => document.activeElement?.getAttribute("data-inbox-trigger") === "messages", "mobile message focus restored");
    await click('[data-inbox-trigger="messages"]');
    await until(() => !!document.querySelector('[data-inbox-list="messages"] a[href*="booking=31"]'), "reopened message list loads");
    await click('[data-inbox-list="messages"] a[href*="booking=31"]');
    await until(() => !!document.querySelector('[role="dialog"] article'), "linked conversation loads");
    await until(() => window.phase2Fixture.writes.some(write => write.path === "/api/inbox/messages/31/read"), "displayed messages acknowledged");
    const receipts = await evaluate(() => window.phase2Fixture.writes.filter(write => write.path === "/api/inbox/messages/31/read"));
    assert.ok(receipts.every(write => write.body.messageIds.length === 1 && write.body.messageIds[0] === "11111111-1111-4111-8111-111111111111"));
    await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "conversation closes");
    await until(() => !document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]'), "acknowledged header count refreshes");
    await assertClean();
  }
  evidence.checks.push("en/lv/ru actual header badges, keyboard/mobile dialog focus, no message previews, linked conversation and displayed-ID receipts");

  await viewport(375, 800); await visit('/inbox?scope=customer&booking=31&scrollReceipt=true');
  await until(() => window.phase2Fixture.writes.some(write => write.path === '/api/inbox/messages/31/read'), 'first exposed incoming receipt');
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes.filter(write => write.path.endsWith('/read')).flatMap(write => write.body.messageIds)), ['11111111-1111-4111-8111-111111111111'], 'offscreen and own messages remain unacknowledged');
  await evaluate(() => { const container = document.querySelector('[data-conversation-message]').parentElement; container.scrollTop = container.scrollHeight; container.dispatchEvent(new Event('scroll')); });
  await until(() => window.phase2Fixture.writes.filter(write => write.path === '/api/inbox/messages/31/read').flatMap(write => write.body.messageIds).includes('33333333-3333-4333-8333-333333333333'), 'second incoming receipt only after scroll');
  assert.equal(await evaluate(() => window.phase2Fixture.writes.filter(write => write.path.endsWith('/read')).flatMap(write => write.body.messageIds).includes('44444444-4444-4444-8444-444444444444')), false);
  await visit('/inbox?scope=customer&booking=31&failMessageRead=true');
  await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), 'receipt error exposes retry');
  assert.equal(await evaluate(() => window.phase2Fixture.writes.filter(write => write.path === '/api/inbox/messages/31/read').length), 1, 'receipt failure not automatically retried');
  await button(resources.en.translation.inbox.retry);
  await until(() => !document.querySelector('[role="dialog"] [role="alert"]') && !document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]'), 'explicit receipt retry succeeds');
  await viewport(375, 300);
  if (!await evaluate(() => document.querySelector('[data-booking-message-privacy]').open)) {
    await evaluate(() => document.querySelector('[data-booking-message-privacy] summary').focus());
    await key("Enter");
  }
  await until(() => !!document.querySelector('[data-booking-message-privacy]')?.open, 'privacy disclosure expanded for outer scroll');
  await evaluate(() => { const dialog = document.querySelector('[role="dialog"]'); dialog.scrollTop = 0; dialog.dispatchEvent(new Event('scroll')); });
  await until(() => document.querySelector('[data-conversation-message]').parentElement.getBoundingClientRect().top >= innerHeight, 'expanded privacy puts history outside outer dialog viewport');
  await evaluate(() => window.phase2Fixture.appendIncoming());
  await until(() => !!document.querySelector('[data-conversation-message="55555555-5555-4555-8555-555555555555"]'), 'new incoming message loaded while history hidden');
  await evaluate(() => { const history = document.querySelector('[data-conversation-message]').parentElement; history.scrollTop = history.scrollHeight; history.dispatchEvent(new Event('scroll')); });
  assert.equal(await evaluate(() => window.phase2Fixture.writes.filter(write => write.path === '/api/inbox/messages/31/read').flatMap(write => write.body.messageIds).includes('55555555-5555-4555-8555-555555555555')), false, 'hidden loaded message is not read');
  await evaluate(() => { const dialog = document.querySelector('[role="dialog"]'), history = document.querySelector('[data-conversation-message]').parentElement; dialog.scrollTop += history.getBoundingClientRect().top - dialog.getBoundingClientRect().top - 24; dialog.dispatchEvent(new Event('scroll')); });
  await until(() => window.phase2Fixture.writes.filter(write => write.path === '/api/inbox/messages/31/read').flatMap(write => write.body.messageIds).includes('55555555-5555-4555-8555-555555555555'), 'outer dialog scroll exposes and acknowledges incoming message');
  evidence.checks.push('inner/outer dialog scroll clipping preserves unread hidden messages; own messages never acknowledged; failed receipts retain unread until explicit retry; removal focus');

  await visit("/my-services/appointments?provider=true"); await viewport(1280, 900); await waitHeart();
  await click('[data-inbox-trigger="notifications"]');
  await until(() => !!document.querySelector('[data-inbox-list="notifications"] [data-notification-unread="true"]'), "daily activity panel");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 0, "opening bell does not mark notification read");
  assert.equal(await evaluate(() => document.querySelector('[data-inbox-list="notifications"]').textContent.includes("UTC")), true);
  await evaluate(() => { window.phase2Fixture.failRead = true; }); await button(resources.en.translation.inbox.markRead);
  await until(() => !!document.querySelector('[data-inbox-list="notifications"] [role="alert"]'), "read failure remains visible");
  assert.equal(await evaluate(() => document.querySelector('[data-notification-unread]').dataset.notificationUnread), "true");
  await button(resources.en.translation.inbox.markRead);
  await until(() => document.querySelector('[data-notification-unread]')?.dataset.notificationUnread === "false", "manual read retry succeeds");
  await key("Escape");
  await evaluate(() => window.phase2Fixture.setUnread(123, 0));
  await until(() => document.querySelector('[data-inbox-trigger="messages"] [data-inbox-badge]')?.textContent === "99+", "large badge caps visually");
  assert.equal(await evaluate(() => document.querySelector('[data-inbox-trigger="messages"]').getAttribute('aria-label').includes('123')), true, "accessible name keeps full count");
  await evaluate(() => window.phase2Fixture.setUnread(0, 0));
  await until(() => !document.querySelector('[data-inbox-badge]'), "zero badges hidden");
  await assertClean();
  evidence.checks.push("desktop bell, reporting UTC, read failure/manual retry, snapshot revisions, 99+ visual/exact accessible count and zero badges");

  await visit("/gallery"); await waitHeart();
  await evaluate(() => { window.phase2Fixture.failMembership = true; return window.phase2Fixture.refresh(); });
  await until(() => !!document.querySelector('[data-fixture-cards] [role="alert"]'), "membership read failure");
  const writesBeforeRetry = await evaluate(() => window.phase2Fixture.writes.length);
  await evaluate(() => { window.phase2Fixture.failMembership = false; }); await click(first); await waitHeart();
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), writesBeforeRetry, "retrying membership does not toggle unknown state");
  await visit("/wishlist?seed=true"); await until(() => !!document.querySelector('[data-wishlist-unavailable="99"]'));
  await evaluate(() => window.phase2Fixture.unavailable(7, true));
  await until(() => !!document.querySelector('[data-wishlist-unavailable="7"]'), "unpublish hides saved service details");
  assert.equal(await evaluate(() => document.querySelector('[data-wishlist-unavailable="7"]').textContent.includes('Synthetic Yoga')), false);
  await evaluate(() => window.phase2Fixture.unavailable(7, false));
  await until(() => !!document.querySelector('[data-wishlist-page] .search-service-card') && !document.querySelector('[data-wishlist-unavailable="7"]'), "republish restores saved entry");
  evidence.checks.push("membership error retry does not save unknown state; unpublish hides details and republish restores membership");

  await visit("/gallery?seed=true"); await waitHeart(); await viewport(320, 800);
  await evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "200% text reflows");
  await checkHeader();
  await evaluate(() => { document.documentElement.style.fontSize = ''; });
  if (process.env.WISHLIST_SCREENSHOT) await fixture.screenshot(process.env.WISHLIST_SCREENSHOT, false);
  const contrast = await measureFormContrast(fixture, "[data-fixture-cards]");
  assert.deepEqual(contrast.failures, []);
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); await assertClean();
  evidence.browsers.push((await fixture.api("Browser.getVersion")).product);
  if (process.env.WISHLIST_EVIDENCE) await writeFile(process.env.WISHLIST_EVIDENCE, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  console.error(JSON.stringify(await evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 500), dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => ({ state: node.getAttribute('data-state'), text: node.textContent.slice(0, 300) })), triggers: [...document.querySelectorAll('[data-inbox-trigger]')].map(node => [node.dataset.inboxTrigger, node.getAttribute('aria-expanded')]), animations: document.getAnimations().map(animation => ({ state: animation.playState, time: animation.currentTime, target: animation.effect?.target?.outerHTML.slice(0, 180) })), unexpected: window.phase2Fixture.unexpected, errors: window.phase2Fixture.writes })), null, 2));
  if (process.env.WISHLIST_FAILURE_SCREENSHOT) await fixture.screenshot(process.env.WISHLIST_FAILURE_SCREENSHOT, false);
  throw error;
} finally { await fixture.close(); }
