import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Load only the frontend loader with mocked external boundaries and a fake clock.
const source = await readFile('client/src/lib/google-maps.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function loader({ fetch, library = async () => ({}), options = () => {} }) {
  const timers = new Map(); let id = 0;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
    fetch, AbortController, setTimeout(callback) { timers.set(++id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
  })(name => { assert.equal(name, '@googlemaps/js-api-loader'); return { importLibrary: library, setOptions: options }; }, module, module.exports);
  return { ...module.exports, expire() { const callbacks = [...timers.values()]; callbacks.forEach(callback => callback()); }, timers };
}
const flush = async () => { for(let i=0;i<20;i++) await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
for (const response of [() => new Response('{}', { status:503 }), () => new Response('{}')]) {
  let imports=0;
  const subject=loader({fetch:async()=>response(), library:async()=>{imports++;}});
  await assert.rejects(subject.loadMapLibraries());
  assert.equal(imports,0);assert.equal(subject.timers.size,0);
}
let configSignal, releaseConfig, configured=0;
const config=loader({fetch:(_url, options)=>{configSignal=options.signal;return new Promise(resolve=>releaseConfig=resolve);},options:()=>configured++});
const pending=config.loadMapLibraries();const rejected=assert.rejects(pending,/timed out/);
config.expire();await rejected;assert.equal(configSignal.aborted,true);
releaseConfig(new Response('{"apiKey":"synthetic"}'));await flush();assert.equal(configured,0,'Late configuration cannot configure an expired attempt');assert.equal(config.timers.size,0);
for(const method of ['loadMapLibraries','loadGeocoder']) {
  let release;
  const subject=loader({fetch:async()=>new Response('{"apiKey":"synthetic"}'),library:()=>new Promise(resolve=>release=resolve)});
  const pending=subject[method]();const rejected=assert.rejects(pending,/timed out/);await flush();subject.expire();await rejected;
  release({});await flush();assert.equal(subject.timers.size,0);
}
let attempts=0;
const recover=loader({fetch:async()=>new Response(++attempts===1?'{}':'{"apiKey":"synthetic"}')});
await assert.rejects(recover.loadMapLibraries());await recover.loadMapLibraries();assert.equal(attempts,2,'A failed configuration may recover on an explicit later attempt');
console.log('Passed Maps missing/rejected config, config/script/geocoder deadlines, abort/late config isolation, cleanup and configuration recovery; all boundaries mocked.');

let lateCallback;
const callbackLoader=loader({fetch:async()=>new Response('{"apiKey":"synthetic"}'),library:async()=>({Geocoder:class{geocode(_request,callback){lateCallback=callback;}}})});
const callbackPending=callbackLoader.geocodeAddress('Synthetic place');const callbackRejected=assert.rejects(callbackPending,/timed out/);await flush();callbackLoader.expire();await callbackRejected;
lateCallback([{formatted_address:'Late synthetic result'}],'OK');await flush();assert.equal(callbackLoader.timers.size,0);
const goodLoader=loader({fetch:async()=>new Response('{"apiKey":"synthetic"}'),library:async()=>({Geocoder:class{geocode(_request,callback){callback([{formatted_address:'Synthetic result'}],'OK');}}})});
assert.equal((await goodLoader.geocodeAddress('Synthetic place')).formatted_address,'Synthetic result');assert.equal(goodLoader.timers.size,0);
console.log('Passed bounded geocoder callback, ignored late callback and successful address resolution.');
