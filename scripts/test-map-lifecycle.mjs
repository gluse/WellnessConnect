import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { previewDescription } from "../client/src/lib/map-preview.ts";
import React from "react";
import renderer from "react-test-renderer";

const { act, create } = renderer;
// tsx uses classic JSX for this project's jsx:preserve setting outside Vite.
globalThis.React = React;
const english = JSON.parse(await readFile(new URL("../client/public/locales/en/translation.json", import.meta.url), "utf8"));
const latvian = JSON.parse(await readFile(new URL("../client/public/locales/lv/translation.json", import.meta.url), "utf8"));
await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation: english }, lv: { translation: latvian } } });
for (const locale of ["en", "lv", "ru"]) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const key of Object.keys(english.mapPreview)) assert.ok(data.mapPreview[key], `${locale}: missing mapPreview.${key}`);
}
assert.equal(previewDescription("  A relaxing\n\t massage.  "), "A relaxing massage.");
assert.equal(previewDescription(null), "");
assert.equal(previewDescription("x".repeat(160)), "x".repeat(160));
assert.equal(Array.from(previewDescription("😀".repeat(180))).length, 160);
assert.ok(previewDescription("Massage and relaxation ".repeat(20)).endsWith("…"));

// Minimal DOM text/event support; any HTML interpolation fails this test.
class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.nodeType = 1; this.parentElement = null; this.children = []; this.attributes = {}; this.listeners = new Map(); this.value = ""; }
  set textContent(value) { this.value = value; this.children = []; }
  get textContent() { return this.value + this.children.map(child => child.textContent).join(""); }
  set innerHTML(_value) { throw new Error("Map previews must never assign HTML"); }
  get innerHTML() { throw new Error("Map previews must not interpolate HTML"); }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
      node.parentElement = this; this.children.push(node);
    }
  }
  before(node) {
    assert.ok(this.parentElement);
    const index = this.parentElement.children.indexOf(this);
    this.parentElement.children.splice(index, 0, node); node.parentElement = this.parentElement;
  }
  querySelector(selector) {
    assert.ok(selector.startsWith("."), "FakeElement supports class queries only");
    for (const child of this.children) {
      if (child.className?.split(" ").includes(selector.slice(1))) return child;
      const nested = child.querySelector(selector); if (nested) return nested;
    }
    return null;
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  emit(name, event = {}) { this.listeners.get(name)?.(event); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
}
class Events {
  constructor() { this.listeners = new Map(); }
  addListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
    return { remove: () => this.listeners.get(name)?.delete(callback) };
  }
  emit(name) { for (const callback of Array.from(this.listeners.get(name) ?? [])) callback(); }
}
const windows = [], timers = new Map(), documentEvents = new Map();
let clock = 0, timerId = 0;
function advance(milliseconds) {
  const end = clock + milliseconds;
  while (true) {
    const due = Array.from(timers).filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]); clock = due[1].at; due[1].callback();
  }
  clock = end;
}
const maps = [];
const markers = [];
let configurationRequests = 0;
let releaseLibrary;
const libraryGate = new Promise(resolve => { releaseLibrary = resolve; });
class FakeMap extends Events {
  constructor(node, options) { super(); this.node = node; this.options = options; this.fitCount = 0; maps.push(this); }
  fitBounds(bounds) { this.bounds = bounds; this.fitCount++; }
  getZoom() { return 12; }
  setZoom() {}
}
class FakeMarker extends Events {
  constructor(options) { super(); this.options = options; markers.push(this); }
  setMap(map) { this.options.map = map; }
}
class FakeInfoWindow extends Events {
  constructor(options) { super(); this.options = options; this.content = options.content; this.opened = false; windows.push(this); }
  setContent(content) { this.content = content; }
  setOptions(options) { Object.assign(this.options, options); }
  open(options) { this.opened = true; this.lastOpen = options; }
  close() { this.opened = false; }
}
const api = {
  maps: {
    Map: FakeMap, Marker: FakeMarker,
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    LatLngBounds: class { constructor() { this.points = []; } extend(point) { this.points.push(point); } },
    InfoWindow: FakeInfoWindow,
    SymbolPath: { CIRCLE: "circle" },
    event: {
      addListenerOnce(target, name, callback) { const handle = target.addListener(name, () => { handle.remove(); callback(); }); return handle; },
      clearInstanceListeners(target) { target.listeners.clear(); },
    },
    async importLibrary(name) {
      await libraryGate;
      return name === "maps" ? { Map: FakeMap } : { Marker: FakeMarker };
    },
  },
};
globalThis.google = api;
globalThis.window = { google: api,
  setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: clock + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
};
globalThis.document = { activeElement: null, createElement: name => new FakeElement(name),
  querySelector(selector) { assert.equal(selector, '[role="dialog"]'); return null; },
  addEventListener(name, callback) { documentEvents.set(name, callback); },
  removeEventListener(name, callback) { if (documentEvents.get(name) === callback) documentEvents.delete(name); },
};
globalThis.fetch = async () => { configurationRequests++; return new Response(JSON.stringify({ apiKey: "test-browser-key" })); };
const { default: GoogleMap } = await import("../client/src/components/google-map.tsx");
const initialLocation = { lat: 56.95, lng: 24.1 };
let component;
await act(async () => {
  component = create(React.createElement(GoogleMap, { services: [], userLocation: initialLocation }), { createNodeMock: () => ({ isMapContainer: true }) });
});
assert.equal(maps.length, 0, "Map must wait for the library");
assert.equal(component.root.findByProps({ role: "status" }).children.length > 0, true);
await act(async () => { releaseLibrary(); await libraryGate; });
assert.equal(maps.length, 1, "Create the map after loading without losing its DOM container");
assert.equal(maps[0].node.isMapContainer, true);
assert.deepEqual(maps[0].options.center, initialLocation);
assert.equal(configurationRequests, 1);
assert.ok(markers.some(marker => marker.options.position.lat === initialLocation.lat));

const updatedLocation = { lat: 57.5, lng: 25.4 };
const offers = [
  { id: 1, latitude: 0, longitude: 0, name: '<img src=x onerror="alert(1)">', description: 'A short <script>alert(1)</script> description.', price: "10", provider: null, duration: 1501, serviceType: "group", instantBooking: true, imageUrl: "/synthetic-image.png" },
  { id: 2, latitude: 56, longitude: 24, name: "Yoga", description: " \n ", price: "20", provider: null, duration: 90 },
  { id: 3, latitude: null, longitude: null, name: "Unlocated", price: "20", provider: null },
  { id: 4, latitude: 55, longitude: 22, name: "Expired Google location", locationSource: "google", locationExpiresAt: "2000-01-01T00:00:00Z", price: "20", provider: null },
];
const selections = [];
await act(async () => {
  component.update(React.createElement(GoogleMap, {
    services: offers,
    userLocation: updatedLocation,
    onServiceSelect: service => selections.push(service.id),
  }));
});
assert.equal(maps.length, 1, "Changing location must update markers without recreating the map");
assert.ok(maps[0].bounds.points.some(point => point.lat === updatedLocation.lat));
assert.ok(maps[0].bounds.points.some(point => point.lat === 0 && point.lng === 0));
assert.equal(configurationRequests, 1, "Location changes must not configure the SDK again");
const activeMarkers = () => markers.filter(marker => marker.options.map != null);
assert.equal(activeMarkers().length, 3, "Only valid, retained coordinates get service markers");
let first = activeMarkers().find(marker => marker.options.title === offers[0].name);
let second = activeMarkers().find(marker => marker.options.title === "Yoga");
let preview = windows.findLast(info => info.options.headerDisabled);
const show = marker => { marker.emit("mouseover"); advance(150); return preview.content; };
first.emit("mouseover"); advance(149); assert.equal(preview.opened, false);
first.emit("mouseout"); advance(300); assert.equal(preview.opened, false, "Quick hover cancellation never opens a stale card");
const card = show(first);
assert.equal(preview.opened, true);
assert.equal(preview.lastOpen.anchor, first);
assert.equal(preview.lastOpen.shouldFocus, false);
assert.equal(preview.options.disableAutoPan, true);
assert.equal(card.children[0].children[0].textContent, offers[0].name);
assert.equal(card.children[1].textContent, offers[0].description, "Markup is rendered as literal text");
assert.equal(card.children[2].textContent, english.mapPreview.viewDetails);
const cardArt = card.querySelector(".search-service-art");
assert.equal(cardArt.children[0].attributes.src, offers[0].imageUrl);
assert.equal(card.querySelector(".search-map-preview-meta").children[0].textContent, "1 day, 1 hour, 1 minute");
assert.ok(card.children[4].textContent.includes(english.searchPage.group));
assert.ok(card.children[4].textContent.includes(english.searchPage.instant));
cardArt.children[0].emit("error");
assert.equal(cardArt.textContent, "◇", "A broken map image has a placeholder");
assert.deepEqual(selections, [], "Hover does not open details or bookings");
first.emit("mouseout"); advance(100); card.emit("mouseenter"); advance(500);
assert.equal(preview.opened, true, "Moving into the preview keeps it open");
card.emit("mouseleave"); advance(250); assert.equal(preview.opened, false);
show(first); first.emit("mouseout"); const secondCard = show(second); advance(300);
assert.equal(preview.lastOpen.anchor, second);
assert.equal(windows.filter(info => info.opened).length, 1);
assert.equal(secondCard.children[1].textContent, english.mapPreview.noDescription);
second.emit("mouseout"); document.activeElement = secondCard.children[2]; secondCard.emit("focusin"); advance(500);
assert.equal(preview.opened, true, "Keyboard focus keeps the preview open");
document.activeElement = null; secondCard.emit("focusout", { relatedTarget: null }); advance(250); assert.equal(preview.opened, false);
show(first); documentEvents.get("keydown")({ key: "Escape" }); assert.equal(preview.opened, false);
show(first).children[0].children[1].emit("click"); assert.equal(preview.opened, false);
for (const event of ["click", "dragstart", "zoom_changed"]) { show(first); maps[0].emit(event); assert.equal(preview.opened, false); }
const markerCount = markers.length, fitCount = maps[0].fitCount, latestSelections = [];
await act(async () => component.update(React.createElement(GoogleMap, { services: offers, userLocation: updatedLocation, onServiceSelect: service => latestSelections.push(service.id) })));
assert.equal(markers.length, markerCount, "Callback changes do not rebuild markers or close previews");
assert.equal(maps[0].fitCount, fitCount, "Unrelated renders do not refit the map");
show(first).children[2].emit("click"); assert.deepEqual(latestSelections, [1]); assert.deepEqual(selections, []);
second.emit("click"); assert.deepEqual(latestSelections, [1, 2], "Marker clicks retain immediate touch/keyboard selection");
assert.equal(preview.opened, false);
const locationMarker = activeMarkers().find(marker => marker.options.title === english.mapPreview.yourLocation);
show(first); locationMarker.emit("click"); assert.equal(preview.opened, false);
assert.equal(windows.filter(info => info.opened).length, 1);
show(second); assert.equal(windows.filter(info => info.opened).length, 1, "Service hover replaces the location popup");
await act(async () => i18next.changeLanguage("lv"));
assert.ok(windows.every(info => !info.opened), "Language changes discard old previews");
first = activeMarkers().find(marker => marker.options.title === offers[0].name);
second = activeMarkers().find(marker => marker.options.title === "Yoga");
preview = windows.findLast(info => info.options.headerDisabled);
assert.equal(show(second).children[2].textContent, latvian.mapPreview.viewDetails);
assert.equal(preview.content.querySelector(".search-map-preview-meta").children[0].textContent, "1 stunda un 30 minūšu");
assert.equal(preview.content.children[1].textContent, latvian.mapPreview.noDescription);
assert.equal(maps.length, 1); assert.equal(configurationRequests, 1);
await act(async () => component.update(React.createElement(GoogleMap, { services: [], userLocation: updatedLocation })));
assert.ok(windows.every(info => !info.opened), "Filtering services closes previews");
assert.equal(timers.size, 0); assert.equal(first.listeners.size, 0);
await act(async () => component.update(React.createElement(GoogleMap, { services: offers, userLocation: updatedLocation })));
first = activeMarkers().find(marker => marker.options.title === offers[0].name);
preview = windows.findLast(info => info.options.headerDisabled);
first.emit("click"); assert.equal(preview.opened, true, "A click can show a preview when no selection callback is supplied");
assert.equal(preview.content.children.length, 4, "No nonfunctional details button is shown; square art and metadata remain");
const originalConsoleError = console.error;
try {
  console.error = () => {};
  await act(async () => { window.gm_authFailure(); });
  assert.ok(component.root.findByProps({ role: "alert" }), "Authentication failures must show an error instead of a blank map");
} finally { console.error = originalConsoleError; }
await act(async () => { component.unmount(); });
assert.equal(window.gm_authFailure, undefined, "Unmount must remove its authentication handler");
assert.ok(markers.every(marker => marker.options.map === null), "Unmount must detach map markers");
assert.ok(markers.every(marker => marker.listeners.size === 0));
assert.equal(documentEvents.size, 0); assert.equal(timers.size, 0);
await act(async () => { component = create(React.createElement(GoogleMap, { services: offers, userLocation: null }), { createNodeMock: () => ({ isMapContainer: true }) }); });
first = activeMarkers().find(marker => marker.options.title === offers[0].name);
first.emit("mouseover"); assert.equal(timers.size, 1);
await act(async () => component.unmount()); advance(500);
assert.ok(windows.every(info => !info.opened), "Unmount cancels pending hover previews");
assert.equal(timers.size, 0); assert.equal(documentEvents.size, 0);
assert.ok(maps.every(map => map.listeners.size === 0));
// Authentication may fail before importLibrary resolves; late success must not
// create a map underneath the fallback, and the list action stays usable.
let releaseLateLibrary;
const lateLibrary = new Promise(resolve => { releaseLateLibrary = () => resolve({ Map: FakeMap }); });
api.maps.importLibrary = () => lateLibrary;
let showList = 0;
const beforeFailure = maps.length;
await act(async () => { component = create(React.createElement(GoogleMap, { services: [], userLocation: null, onShowList: () => showList++ }), { createNodeMock: () => ({ isMapContainer: true }) }); });
try {
  console.error = () => {};
  await act(async () => window.gm_authFailure());
} finally { console.error = originalConsoleError; }
const listButton = component.root.findAllByType("button").find(button => button.children.includes(latvian.searchPage.backList));
assert.ok(listButton, "Map auth failure offers the list fallback");
await act(async () => listButton.props.onClick());
assert.equal(showList, 1);
await act(async () => releaseLateLibrary());
assert.equal(maps.length, beforeFailure, "Late loading cannot construct a map after authentication failure");
await act(async () => component.unmount());
console.log("Passed: async map loading, location retention, delayed hover/cancellation, safe short descriptions, hover/focus persistence, dismissal, latest callbacks, touch/keyboard selection, translations, auth errors, and listener/timer cleanup.");
