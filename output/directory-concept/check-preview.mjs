import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { browserFixture } from '../../scripts/fixtures/browser-harness.mjs';
const fragment=await readFile(new URL('./business-directory.html',import.meta.url),'utf8');
new Script(fragment.match(/<script>([\s\S]*?)<\/script>/)[1]);
const document='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f7f8fc}i[data-lucide]{display:inline-block;width:18px;height:18px;flex-shrink:0}</style>'+fragment+'</html>';
const f=await browserFixture({html:document});
const prefix='[data-layout="sections"] ';
const go=action=>f.click(prefix+'[data-go="'+action+'"]');
const snap=name=>f.screenshot('output/directory-concept/'+name+'.png');
const evidence=[];
try{
 await f.api('Page.navigate',{url:f.origin});
 await f.until(()=>document.querySelector('.fd-phone main h1'));
 for(const width of [736,390,320]){
  await f.viewport(width,1200);
  const result=await f.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
  if(result.overflow)throw Error('Horizontal overflow: '+width);
  evidence.push(result);
 }
 await f.viewport(390,1200);await snap('search');
 await f.click(prefix+'[data-control="available"]');
 if(!await f.evaluate(()=>document.querySelector('[data-layout=sections] [data-part=businesses]').hidden))throw Error('Availability separation failed');
 await f.click(prefix+'[data-control="available"]');
 await go('detail');await snap('business-details');
 await go('interest');await f.until(()=>document.querySelector('[data-layout=sections] main h1').textContent.includes('saved'));
 await f.click(prefix+'[data-control="notify"]');await snap('interest-saved');
 await go('undo');await go('claim');await snap('claim');
 await f.click(prefix+'[data-form=claim] button[type=submit]');
 if(!await f.evaluate(()=>!!document.querySelector('[data-layout=sections] [data-form=claim]')))throw Error('Required authority check bypassed');
 await f.click(prefix+'[data-form=claim] input[type=checkbox]');
 await f.click(prefix+'[data-form=claim] button[type=submit]');
 await f.until(()=>document.querySelector('[data-layout=sections] main h1').textContent.includes('Verification requested'));
 await snap('claim-review');
 await f.evaluate(()=>{document.querySelector('[data-variant="Search sections"]').hidden=true;document.querySelector('[data-variant="Businesses tab"]').hidden=false;});
 await f.click('[data-layout=tabs] [data-go=businesses-tab]');
 await snap('businesses-tab');
 await f.api('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
 await snap('dark-preview');
 if(f.errors.length)throw Error(f.errors.join('\n'));
 await writeFile(new URL('./preview-checks.json',import.meta.url),JSON.stringify({layouts:evidence,flows:['availability separation','details','interest','notification preference','undo','claim required authority','claim review','businesses tab'],runtimeErrors:f.errors,externalRequests:f.blocked},null,2));
 console.log('Preview checks passed; screenshots saved.');
}finally{await f.close();}
