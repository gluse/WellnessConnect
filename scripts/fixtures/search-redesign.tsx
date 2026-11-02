import "./search-page";

// A DOM-backed Maps boundary: exercise the real GoogleMap and preview rendering
// without external SDK requests, geographic data, credentials or paid services.
class Events {
  listeners = new Map<string, Set<() => void>>();
  addListener(name: string, callback: () => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(callback);
    return { remove: () => this.listeners.get(name)?.delete(callback) };
  }
  emit(name: string) { this.listeners.get(name)?.forEach(callback => callback()); }
}
class MockMap extends Events {
  constructor(public node: HTMLElement) {
    super(); node.style.cssText = "padding:16px;background:#edf1ed;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;";
    const label = document.createElement("p"); label.textContent = "Offline map fixture"; label.style.width = "100%"; node.append(label);
  }
  fitBounds() {}
  getZoom() { return 12; }
  setZoom() {}
}
class MockMarker extends Events {
  node = document.createElement("button");
  constructor(options: { title: string; map: MockMap }) {
    super(); this.node.type = "button"; this.node.textContent = options.title; this.node.dataset.mapMarker = options.title;
    this.node.style.cssText = "padding:12px;border:1px solid #4338ca;background:white;border-radius:12px;";
    for (const name of ["mouseover", "mouseout", "click"]) this.node.addEventListener(name, () => this.emit(name));
    options.map.node.append(this.node);
  }
  setMap(map: MockMap | null) { if (!map) this.node.remove(); }
}
class MockInfoWindow {
  content?: HTMLElement | string;
  node = document.createElement("div");
  constructor(options: { content?: HTMLElement }) { this.content = options.content; }
  setContent(content: HTMLElement | string) { this.content = content; this.node.replaceChildren(); }
  setOptions() {}
  open({ map }: { map: MockMap }) {
    if (typeof this.content !== "string" && this.content) this.node.append(this.content);
    this.node.style.cssText = "width:100%;padding:12px;background:white;border-radius:12px;";
    map.node.append(this.node);
  }
  close() { this.node.remove(); }
}
const original = google.maps.importLibrary.bind(google.maps);
Object.assign(google.maps, {
  Marker: MockMarker,
  InfoWindow: MockInfoWindow,
  Size: class {}, Point: class {}, SymbolPath: { CIRCLE: "circle" },
  LatLngBounds: class { extend() {} },
  event: {
    clearInstanceListeners(target: Events) { target.listeners?.clear(); },
    addListenerOnce(target: Events, name: string, callback: () => void) { return target.addListener(name, callback); },
  },
  importLibrary: (name: string) => name === "maps" ? Promise.resolve({ Map: MockMap }) : name === "marker" ? Promise.resolve({ Marker: MockMarker }) : original(name as "geocoding"),
});
