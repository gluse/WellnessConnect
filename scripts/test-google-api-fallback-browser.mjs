import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {browserFixture} from './fixtures/browser-harness.mjs';
const resources={};
for(const locale of ['en','lv','ru']) resources[locale]={translation:JSON.parse(await readFile(`client/public/locales/${locale}/translation.json`,'utf8'))};
const fixture=await browserFixture({entry:'scripts/fixtures/search-page.tsx',resources});
const {evaluate,until,click,set,key,viewport,visit}=fixture;
const settled=()=>until(()=>document.querySelector('.search-results')?.getAttribute('aria-busy')==='false','search settled');
const open=async()=>{await click('[data-testid="open-search-location"]');await until(()=>!!document.querySelector('.search-location-dialog'),'location dialog');};
const closed=()=>until(()=>!document.querySelector('.search-location-dialog'),'dialog closed');
const count=()=>evaluate(()=>document.querySelectorAll('.search-service-card').length);
const params=async()=>new URL(await evaluate(()=>window.searchFixture.requests.at(-1)),'http://fixture.invalid').searchParams;
const checks=[],matrix=[];
try{
 await viewport(1280);await visit('/search');await until(()=>!!document.querySelector('[data-testid="browse-without-location"]'),'initial choice');
 assert.equal(await evaluate(()=>window.searchFixture.requests.length),0,'Initial location prompt preserves explicit opt-in');
 await evaluate(()=>window.searchFixture.mapsConfig='missing');
 await set('modal-search-location','Unresolvable synthetic address');await click('[data-testid="confirm-search-location"]');
 await until(()=>!!document.querySelector('#search-query-feedback'),'address failure');
 await click('[data-testid="browse-without-location"]');await closed();await settled();assert.equal(await count(),3);
 assert.equal((await params()).has('latitude'),false);assert.equal((await params()).has('radius'),false);
 assert.equal(await evaluate(()=>document.querySelector('.search-desktop-filters [data-testid="input-distance"]').disabled),true);
 assert.equal(await evaluate(()=>document.querySelectorAll('.search-service-card [data-testid^="text-distance-"]').length),0);
 checks.push('Missing Maps key: failed address offers explicit browsing; catalog renders without coordinate/radius parameters or distances');
 await set('service-query','yoga');await click('[data-testid="button-search-services"]');await settled();assert.equal(await count(),1);
 assert.equal((await params()).get('searchQuery'),'yoga');
 const category=await evaluate(()=>document.querySelector('.search-desktop-filters [data-testid="search-category"]').id);await set(category,'health_wellness');
 await click('.search-desktop-filters button[type="submit"]');await settled();assert.equal((await params()).get('category'),'health_wellness');assert.equal((await params()).has('radius'),false);
 await click('[data-testid="button-view-map"]');await until(()=>!!document.querySelector('.search-map [role="alert"]'),'map error fallback');
 assert.equal(await evaluate(()=>document.querySelector('.search-map [role="alert"] button').textContent),resources.en.translation.searchPage.backList);
 await click('.search-map [role="alert"] button');assert.equal(await count(),1);
 checks.push('Keyword and category filtering work without Google; map failure offers direct return to the matching list');
 await open();await click('.search-location-gps');await closed();await settled();
 assert.equal((await params()).get('latitude'),'0');assert.equal((await params()).get('radius'),'25');assert.equal((await params()).get('searchQuery'),'yoga');
 assert.equal(await evaluate(()=>window.savedLocationFixture.geocodes),0,'GPS never geocodes');
 await open();await click('[data-testid="forget-search-location"]');await settled();assert.equal((await params()).has('latitude'),false);
 await click('[data-testid="browse-without-location"]');await closed();assert.equal(await count(),1);
 checks.push('Fallback to GPS to forget to fallback retains applied query/category, and GPS remains independent of Google');
 // Save a typed guest preference, then revisit with geocoding held indefinitely.
 // Use the real serialized cookie produced by the UI so fixture data follows the current contract.
 await evaluate(()=>window.searchFixture.mapsConfig='success');await open();await set('modal-search-location','Saved synthetic place');
 await click('[data-testid="remember-search-location"]');await click('[data-testid="confirm-search-location"]');await closed();await settled();
 const remembered=await evaluate(()=>document.cookie);assert.ok(remembered.includes('fmt.search-location.v1='));
 await visit('/search?geocode=pending');await until(()=>!!window.searchFixture.resolveGeocode,'saved address pending');
 assert.equal(await evaluate(()=>document.querySelector('[data-testid="browse-without-location"]').disabled),false);
 await click('[data-testid="browse-without-location"]');await closed();await settled();assert.equal(await count(),3);assert.equal((await params()).has('latitude'),false);
 assert.equal(await evaluate(()=>document.cookie),remembered,'Browsing preserves the remembered preference');
 await evaluate(()=>window.searchFixture.resolveGeocode());await settled();assert.equal((await params()).has('latitude'),false);assert.equal(await evaluate(()=>!!document.querySelector('.search-location-dialog')),false);
 checks.push('Pending saved-address restoration can be bypassed immediately; late resolution cannot reactivate location, reopen the dialog, or delete the preference');
 // Restoration failure remains retryable and an explicit retry reactivates location.
 await visit('/search?geocode=error');await until(()=>!!document.querySelector('.search-location-error'),'restore failure');await click('[data-testid="browse-without-location"]');await closed();await settled();assert.equal(await count(),3);
 await open();await evaluate(()=>window.searchFixture.geocode='success');await click('.search-location-error button');await closed();await settled();assert.equal((await params()).get('radius'),'25');
 checks.push('Failed remembered-address restoration offers browsing and preserves explicit retry; successful retry uses the restored location');
 // Invalid unfinished radius cannot trap no-location browsing behind a disabled field.
 const radius=await evaluate(()=>document.querySelector('.search-desktop-filters [data-testid="input-distance"]').id);await set(radius,'');await open();await click('[data-testid="browse-without-location"]');await closed();
 await click('.search-desktop-filters button[type="submit"]');await settled();assert.equal(await evaluate(()=>!!document.querySelector('.search-filter-error')),false);
 await set('service-query','yoga');await click('[data-testid="button-search-services"]');await settled();assert.equal((await params()).has('radius'),false);
 for(const locale of ['en','lv','ru']){
  await set('fixture-language',locale);
  for(const width of [320,390,768,1280]){
   await viewport(width,width===768?480:900);await open();await fixture.settle();
   assert.equal(await evaluate(()=>document.querySelector('[data-testid="browse-without-location"]').textContent),resources[locale].translation.searchLocation.browseWithout);
   assert.ok(await evaluate(()=>{const d=document.querySelector('.search-location-dialog'),b=d.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1;}));
   await evaluate(()=>document.querySelector('[data-testid="browse-without-location"]').focus());await key('Enter');await closed();await settled();
   assert.ok(await evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${locale}/${width} reflows`);
   matrix.push({locale,width});
  }
  await viewport(locale==='en'?1280:390);await fixture.screenshot(`docs/google-api-fallback-${locale}.png`);
 }
 checks.push('Disabled invalid radius cannot block browsing; translated action works with keyboard in en/lv/ru at phone/tablet/desktop and short viewport sizes');
 assert.deepEqual(await evaluate(()=>window.searchFixture.unexpected),[]);assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.network,[]);assert.deepEqual(fixture.blocked,[]);
 await writeFile('docs/google-api-fallback-browser-evidence.json',JSON.stringify({date:'2026-10-23',checks,matrix,browser:(await fixture.api('Browser.getVersion')).product,services:'Isolated static UI; all APIs, preferences, Google and GPS mocked; no connected server/DB',deferred:['ar/RTL','zh','fr','de','hi','ja','pt','es'],limits:'No physical device, screen reader, native-language or live Google outage verification'},null,2)+'\n');
 console.log(`Passed Google API fallback browser: ${checks.length} groups, ${matrix.length} locale/viewport cases`);
}finally{await fixture.close();}
