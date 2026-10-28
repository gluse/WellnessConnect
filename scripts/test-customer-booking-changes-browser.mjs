import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";
const languages = ["en","lv","ru"], resources = {};
for (const language of languages) resources[language] = {translation:JSON.parse(await readFile(`client/public/locales/${language}/translation.json`,"utf8"))};
for (const language of languages) {
  assert.deepEqual(Object.keys(resources[language].translation.bookingChanges),Object.keys(resources.en.translation.bookingChanges));
  for (const [key,value] of Object.entries(resources[language].translation.bookingChanges)) {
    assert.ok(value.trim()); assert.deepEqual(value.match(/{{\w+}}/g),resources.en.translation.bookingChanges[key].match(/{{\w+}}/g));
  }
}
const fixture = await browserFixture({entry:"scripts/fixtures/customer-booking-changes.tsx",resources, ...(process.env.BOOKING_NATIVE_ZOOM ? {nativeZoom:4} : {})});
const {evaluate, until, visit, viewport, click, button, key, screenshot} = fixture;
const configure = value => evaluate(value => Object.assign(window.phase2Fixture,value),value);
const writes = () => evaluate(() => window.phase2Fixture.writes);
const opened = () => until(() => !!document.querySelector('[role="dialog"][data-state="open"]'),"change dialog open");
const closed = () => until(() => !document.querySelector('[role="dialog"][data-state="open"]'),"change dialog closed");
const reflow = async () => assert.deepEqual(await evaluate(() => ({page:document.documentElement.scrollWidth<=innerWidth+1,dialog:!document.querySelector('[role="dialog"]') || document.querySelector('[role="dialog"]').scrollWidth<=document.querySelector('[role="dialog"]').clientWidth+1})),{page:true,dialog:true});
const choose = async () => {
  await until(() => !!document.querySelector('button[name="day"]:not([disabled])'),"available day");
  await click('button[name="day"]:not([disabled])');
  await until(() => !!document.querySelector('fieldset button[aria-pressed="false"]'),"available slot");
  await click('fieldset button[aria-pressed="false"]');
};
const checks = [], matrix = [], screenshots = [];
try {
  for (const language of languages) {
    const t = resources[language].translation.bookingChanges;
    if (!process.env.BOOKING_NATIVE_ZOOM) await viewport(language === "lv" ? 768 : language === "ru" ? 375 : 1280,900);
    await visit("/my-bookings?lang="+language);
    await until(() => document.querySelectorAll('article').length === 2,"only customer's bookings loaded");
    assert.equal(await evaluate(() => [...document.querySelectorAll('article')].filter(article => article.querySelectorAll('button').length===2).length),2,"only own future pending/confirmed controls");
    assert.equal(await evaluate(() => [...document.querySelectorAll('article button')].some(button => /Approve|Mark complete|Decline/.test(button.textContent))),false,"provider actions never exposed");
    await button("Past & cancelled");
    assert.equal(await evaluate(() => document.querySelectorAll('article').length),3,"past confirmed, completed and cancelled history stays visible");
    assert.equal(await evaluate(() => document.querySelectorAll('article button').length),0,"past or terminal bookings have no customer changes");
    await button("Upcoming");
    await click('article button:last-child'); await opened();
    assert.equal(await evaluate(() => document.activeElement.textContent),t.keep,"safe initial focus");
    assert.equal((await writes()).length,0,"opening cancellation does not write");
    await reflow(); await key("Escape"); await closed();
    await until(() => document.activeElement.tagName === "BUTTON","dismiss focus restored");
    assert.equal(await evaluate(() => document.activeElement.textContent),t.cancel,"restore trigger focus on dismiss");
    await click('article button:last-child'); await opened(); await button(t.keep); await closed();
    assert.equal((await writes()).length,0,"keeping booking never writes");
    await click('article button:last-child'); await opened();
    await configure({result:"denied"}); await button(t.confirmCancel);
    await until(() => !!document.querySelector('[role="alert"]'),"denied cancellation");
    assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent),t.denied);
    assert.equal(await evaluate(() => window.phase2Fixture.cache()[0].status),"confirmed");
    await configure({result:"pending"}); await button(t.confirmCancel);
    await until(() => [...document.querySelectorAll('[role="dialog"] button')].every(button=>button.disabled),"pending controls disabled");
    const count = (await writes()).length;
    await key("Escape"); assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"][data-state="open"]')),true);
    await evaluate(() => document.querySelector('[role="dialog"] button:last-of-type').click());
    assert.equal((await writes()).length,count,"pending duplicate protection");
    await evaluate(() => window.phase2Fixture.resolve()); await closed();
    await until(() => document.querySelectorAll('article').length===1,"cancelled card removed");
    await until(() => document.activeElement.tagName === "H1","cancel success focus restored");
    assert.equal(await evaluate(() => document.activeElement.tagName),"H1","focus falls back to heading after removal");
    assert.equal(await evaluate(() => window.phase2Fixture.cache()[0].status),"cancelled");
    assert.equal(await evaluate(() => window.phase2Fixture.providerInvalidated()),true);
    assert.ok((await writes()).some(write=>write.path==="/api/bookings/1/status"&&write.body.status==="cancelled"));
    await click('article button:first-child'); await opened();
    await choose(); await configure({result:"conflict"}); await button(t.saveTime);
    await until(() => !!document.querySelector('[role="alert"]'),"reschedule conflict");
    assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent),t.conflict);
    assert.equal(await evaluate(text => [...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent===text).disabled,t.saveTime),true,"conflict clears selected slot");
    await until(() => [...document.querySelectorAll('fieldset button[aria-pressed="false"]')].some(button=>button.textContent.includes("12:00")),"slots refreshed after conflict");
    await click('fieldset button[aria-pressed="false"]');
    await configure({result:"error"}); await button(t.saveTime);
    await until(() => !!document.querySelector('[role="alert"]'),"rejected reschedule");
    assert.equal(await evaluate(() => document.querySelector('[role="alert"]').textContent),t.failed);
    assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"] img')),false,"server messages never rendered as markup");
    await configure({result:"success"}); await button(t.saveTime); await closed();
    await until(() => window.phase2Fixture.cache()[1].scheduledDate.includes("11:00:00"),"rescheduled cache refreshed");
    assert.ok((await writes()).some(write=>write.path==="/api/bookings/2/reschedule"&&write.body.scheduledDate==="2030-01-16T11:00:00.000Z"));
    await click('article button:first-child'); await opened(); await reflow();
    for(let index=0;index<16;index++) { await key("Tab"); assert.equal(await evaluate(() => !!document.activeElement.closest('[role="dialog"]')),true,"dialog focus remains contained"); }
    const file=`docs/customer-booking-${process.env.FORMS_BROWSER||"chrome"}-${language}${process.env.BOOKING_NATIVE_ZOOM?"-zoom400":""}.png`;
    if(process.env.BOOKING_NATIVE_ZOOM) await evaluate(()=>{document.querySelector('[role="dialog"]').scrollTop=0;});
    await screenshot(file, !process.env.BOOKING_NATIVE_ZOOM); screenshots.push(file);
    if(process.env.BOOKING_NATIVE_ZOOM) {
      await evaluate(text=>{const button=[...document.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent===text);button.focus();button.scrollIntoView({block:"nearest"});},t.dismiss);
      assert.equal(await evaluate(()=>{const box=document.activeElement.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight;}),true,"zoomed footer focus remains visible");
      const actions=file.replace(".png","-actions.png"); await screenshot(actions,false); screenshots.push(actions);
    }
    await key("Escape"); await closed();
    matrix.push({language,width:await evaluate(()=>innerWidth),height:await evaluate(()=>innerHeight),nativeZoom:process.env.BOOKING_NATIVE_ZOOM?4:1});
    checks.push(language+": own future controls; no provider actions; cancel dismiss/denial/pending/duplicate/success; conflict slot recovery; rejected reschedule retention; canonical payload; cache invalidation; focus and reflow");
    assert.deepEqual(await evaluate(()=>window.phase2Fixture.unexpected),[]);
  }
  await visit("/my-bookings?lang=en"); await until(()=>document.querySelectorAll('article').length===2,"fresh bookings");
  await click('article button:last-child'); await opened(); await configure({result:"pending"}); await button(resources.en.translation.bookingChanges.confirmCancel);
  await evaluate(()=>window.phase2Fixture.switchUser()); await closed();
  await evaluate(()=>{window.phase2Fixture.result="unauthorized";window.phase2Fixture.resolve();});
  await until(()=>document.querySelectorAll('article').length===0,"switched account hides all prior private bookings");
  assert.equal(await evaluate(()=>document.querySelectorAll('article button').length),0,"old account never offers actions after identity change");
  checks.push("Account switch closes old dialog and ignores old mutation's 401 without clearing the new identity.");
  await visit("/my-bookings?lang=en"); await until(()=>document.querySelectorAll('article').length===2,"refresh-failure fixture");
  await click('article button:last-child'); await opened(); await configure({refreshError:true}); await button(resources.en.translation.bookingChanges.confirmCancel); await closed();
  await until(()=>!!document.querySelector('[role="alert"]'),"refresh failed after confirmed cancellation");
  assert.equal(await evaluate(()=>document.querySelectorAll('article').length),1,"confirmed cancellation remains applied even when list refresh fails");
  assert.equal(await evaluate(()=>window.phase2Fixture.cache()[0].status),"cancelled");
  checks.push("Canonical successful mutation updates the retained list even if the follow-up list refresh fails; retry warning remains visible.");
  await visit("/my-bookings?lang=en"); await until(()=>document.querySelectorAll('article').length===2,"fresh session");
  await click('article button:last-child'); await opened(); await configure({result:"unauthorized"}); await button(resources.en.translation.bookingChanges.confirmCancel);
  await until(()=>location.pathname==="/login","expired-session redirect");
  assert.equal(await evaluate(()=>document.querySelectorAll('article').length),0,"expired auth hides private bookings");
  checks.push("Current-account mutation 401 clears authentication/private booking cache and redirects to sign in.");
  assert.deepEqual(fixture.errors,[]); assert.deepEqual(fixture.network,[]); assert.deepEqual(fixture.blocked,[]);
  const evidence={date:"2026-10-27",browser:await fixture.api("Browser.getVersion"),matrix,checks,screenshots,mocked:"All API/auth reads and writes intercepted in memory; no app server, database, sessions or external services",deferred:["ar including RTL","zh","fr","de","hi","ja","pt","es"],limitations:["No physical devices, screen readers or live connected-service verification"]};
  await writeFile(`docs/customer-booking-${process.env.FORMS_BROWSER||"chrome"}${process.env.BOOKING_NATIVE_ZOOM?"-zoom400":""}-evidence.json`,JSON.stringify(evidence,null,2)+"\n");
  console.log("Passed customer booking mutation browser regressions:",checks.length,"checks",JSON.stringify(matrix));
} finally { await fixture.close(); }
