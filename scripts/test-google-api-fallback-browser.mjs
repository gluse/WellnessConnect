import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {browserFixture} from './fixtures/browser-harness.mjs';
const resources={};
for(const locale of ['en','lv','ru']) resources[locale]={translation:JSON.parse(await readFile(`client/public/locales/${locale}/translation.json`,'utf8'))};
const fixture=await browserFixture({entry:'scripts/fixtures/search-page.tsx',resources});
const {evaluate,until,click,set,key,viewport,visit}=fixture;
const settled=()=>until(()=>document.querySelector('.search-results')?.getAttribute('aria-busy')==='false'&&!document.querySelector('[data-testid="button-search-services"]').disabled,'search settled');
const count=()=>evaluate(()=>document.querySelectorAll('.search-service-card').length);
const params=async()=>new URL(await evaluate(()=>window.searchFixture.requests.at(-1)),'http://fixture.invalid').searchParams;
const checks=[],matrix=[];
try{
 await viewport(1280);await visit('/search');await settled();assert.equal(await count(),3);
 assert.equal((await params()).has('latitude'),false);assert.equal((await params()).has('radius'),false);
 assert.equal(await evaluate(()=>window.searchFixture.locationRequests.length),0,'No automatic GPS request');
 await evaluate(()=>window.searchFixture.mapsConfig='missing');
 await set('service-query','yoga');await set('search-location','Unresolvable synthetic place');await click('[data-testid="button-search-services"]');await settled();
 assert.ok(await evaluate(()=>!!document.querySelector('#search-query-feedback')));assert.equal(await count(),3,'Location failure retains catalog');
 await click('[data-testid="browse-without-location"]');await settled();
 assert.equal(await evaluate(()=>document.querySelector('#search-location').value),'');
 assert.equal(await evaluate(()=>document.querySelector('#service-query').value),'yoga','Fallback preserves unfinished query');
 await click('[data-testid="button-search-services"]');await settled();assert.equal(await count(),1);assert.equal((await params()).get('searchQuery'),'yoga');assert.equal((await params()).has('radius'),false);
 const category=await evaluate(()=>document.querySelector('.search-desktop-filters [data-testid="search-category"]').id);await set(category,'health_wellness');await click('.search-desktop-filters button[type="submit"]');await settled();assert.equal((await params()).get('category'),'health_wellness');
 assert.equal(await evaluate(()=>document.querySelector('.search-desktop-filters [data-testid="input-distance"]').disabled),true);
 assert.equal(await evaluate(()=>document.querySelector('option[value="distance-asc"]').disabled),true);
 assert.equal(await evaluate(()=>document.querySelectorAll('.search-service-card [data-testid^="text-distance-"]').length),0);
 checks.push('Missing key preserves catalog, explicit browse clears failed address while preserving query, and query/category filtering works without coordinates/radius/distances');
 await click('[data-testid="button-view-map"]');await until(()=>!!document.querySelector('.search-map [role="alert"]'),'map fallback');
 assert.equal(await evaluate(()=>document.querySelector('.search-map [role="alert"] button').textContent),resources.en.translation.searchPage.backList);
 await click('.search-map [role="alert"] button');assert.equal(await count(),1);
 checks.push('Unavailable map offers direct return to the matching service list');
 await click('.search-locate-button');await settled();assert.equal((await params()).get('latitude'),'0');assert.equal((await params()).get('radius'),'50');
 assert.equal(await evaluate(()=>window.searchFixture.geocodes),0,'GPS never geocodes');
 await set('search-location','Another unavailable place');await click('[data-testid="button-search-services"]');await settled();
 assert.equal((await params()).get('latitude'),'0');assert.equal(await count(),1,'Failed address change retains valid GPS results');
 const radius=await evaluate(()=>document.querySelector('.search-desktop-filters [data-testid="input-distance"]').id);await set(radius,'');
 await click('[data-testid="browse-without-location"]');await settled();
 await click('.search-desktop-filters button[type="submit"]');await settled();assert.equal(await evaluate(()=>!!document.querySelector('.search-filter-error')),false);
 await set('service-query','massage');await click('[data-testid="button-search-services"]');await settled();assert.equal((await params()).has('radius'),false);assert.equal((await params()).get('category'),'health_wellness');assert.equal(await count(),1);
 checks.push('GPS works without Google; failed address updates preserve valid location/results; browsing resets invalid disabled radius and retains other applied filters');
 for(const locale of ['en','lv','ru']){
  await set('fixture-language',locale);
  for(const width of [320,390,768,1280]){
   await viewport(width,width===768?480:900);await fixture.settle();
   assert.equal(await evaluate(()=>document.querySelector('[data-testid="browse-without-location"]').textContent),resources[locale].translation.searchLocation.browseWithout);
   await evaluate(()=>document.querySelector('[data-testid="browse-without-location"]').focus());await key('Enter');await settled();
   assert.ok(await evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${locale}/${width} reflows`);matrix.push({locale,width});
  }
  await viewport(locale==='en'?1280:390);await fixture.screenshot(`docs/google-api-fallback-commit-${locale}.png`);
 }
 checks.push('Localized browse action works with keyboard in en/lv/ru at phone/tablet/desktop and short viewport sizes');
 assert.deepEqual(await evaluate(()=>window.searchFixture.unexpected),[]);assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.network,[]);assert.deepEqual(fixture.blocked,[]);
 await writeFile('docs/google-api-fallback-commit-browser-evidence.json',JSON.stringify({date:'2026-10-25',checks,matrix,browser:(await fixture.api('Browser.getVersion')).product,services:'Isolated HEAD-compatible static UI; all APIs, Google and GPS mocked; no connected server/DB',deferred:['ar/RTL','zh','fr','de','hi','ja','pt','es'],limits:'Inline location flow only; saved-location/modal feature remains outside this commit. No physical device, screen reader, native-language or live Google outage verification'},null,2)+'\n');
 console.log(`Passed HEAD-compatible Google API fallback browser: ${checks.length} groups, ${matrix.length} locale/viewport cases`);
}finally{await fixture.close();}
