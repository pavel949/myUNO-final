import { vi } from 'vitest';

// Shared inert MapLibre double; never imports or instantiates real WebGL code.
export function createMapLibreFake(failControl = false) {
  const maps: FakeMap[] = [];
  const markers: FakeMarker[] = [];
  const popupContents: Node[] = [];
  class FakeMap {
    listeners = new Map<string, Set<() => void>>();
    on = vi.fn((type: string, listener: () => void) => {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(listener);
      return this;
    });
    off = vi.fn((type: string, listener: () => void) => {
      this.listeners.get(type)?.delete(listener);
      return this;
    });
    emit(type: string) { [...(this.listeners.get(type) ?? [])].forEach((listener) => listener()); }
    addControl = vi.fn(() => { if (failControl) throw new Error('control failed'); });
    remove = vi.fn();
    fitBounds = vi.fn();
    getBounds = vi.fn(() => ({
      getSouth: () => 7.12345678, getWest: () => 98.12345678,
      getNorth: () => 8.12345678, getEast: () => 99.12345678,
    }));
    constructor() { maps.push(this); }
  }
  class FakeMarker {
    element: HTMLElement;
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setPopup = vi.fn(() => this);
    addTo = vi.fn(() => this);
    constructor({ element }: { element: HTMLElement }) { this.element = element; markers.push(this); }
  }
  const api = {
    setWorkerUrl: vi.fn(),
    getVersion: () => '6.15.0',
    Map: FakeMap,
    Marker: FakeMarker,
    NavigationControl: class {},
    Popup: class { setDOMContent(node: Node) { popupContents.push(node); return this; } },
    LngLatBounds: class { extend() { return this; } isEmpty() { return false; } },
  };
  return { api, maps, markers, popupContents };
}
