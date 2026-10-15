import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";

const { act, create } = renderer;
// tsx uses classic JSX for this project's jsx:preserve setting outside Vite.
globalThis.React = React;
const maps = [];
const markers = [];
let configurationRequests = 0;
let releaseLibrary;
const libraryGate = new Promise(resolve => { releaseLibrary = resolve; });
class FakeMap {
  constructor(node, options) { this.node = node; this.options = options; maps.push(this); }
  fitBounds(bounds) { this.bounds = bounds; }
  getZoom() { return 12; }
  setZoom() {}
}
class FakeMarker {
  constructor(options) { this.options = options; markers.push(this); }
  setMap(map) { this.options.map = map; }
  addListener() {}
}
const api = {
  maps: {
    Map: FakeMap, Marker: FakeMarker,
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    LatLngBounds: class { constructor() { this.points = []; } extend(point) { this.points.push(point); } },
    InfoWindow: class { open() {} },
    SymbolPath: { CIRCLE: "circle" },
    event: { addListenerOnce() {}, clearInstanceListeners() {} },
    async importLibrary(name) {
      await libraryGate;
      return name === "maps" ? { Map: FakeMap } : { Marker: FakeMarker };
    },
  },
};
globalThis.google = api;
globalThis.window = { google: api };
globalThis.document = { createElement: () => ({ textContent: "", get innerHTML() { return this.textContent; } }) };
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
await act(async () => {
  component.update(React.createElement(GoogleMap, {
    services: [{ latitude: 0, longitude: 0, name: "Zero coordinate service", price: "10", provider: null }],
    userLocation: updatedLocation,
  }));
});
assert.equal(maps.length, 1, "Changing location must update markers without recreating the map");
assert.ok(maps[0].bounds.points.some(point => point.lat === updatedLocation.lat));
assert.ok(maps[0].bounds.points.some(point => point.lat === 0 && point.lng === 0));
assert.equal(configurationRequests, 1, "Location changes must not configure the SDK again");
const originalConsoleError = console.error;
try {
  console.error = () => {};
  await act(async () => { window.gm_authFailure(); });
  assert.ok(component.root.findByProps({ role: "alert" }), "Authentication failures must show an error instead of a blank map");
} finally { console.error = originalConsoleError; }
await act(async () => { component.unmount(); });
assert.equal(window.gm_authFailure, undefined, "Unmount must remove its authentication handler");
assert.ok(markers.every(marker => marker.options.map === null), "Unmount must detach map markers");
console.log("Map tests passed: async loading, persistent container, location updates, zero coordinates, auth errors, and cleanup.");
