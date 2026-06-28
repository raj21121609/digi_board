/**
 * LayerManager.js
 * Manages an ordered list of layers.
 * Each layer has its own OffscreenCanvas for compositing.
 */

let _layerIdCounter = 1;

export function createLayerId() {
  return `layer_${_layerIdCounter++}`;
}

/**
 * Layer schema:
 * {
 *   id: string,
 *   name: string,
 *   visible: boolean,
 *   locked: boolean,
 *   opacity: number,         // 0–1
 *   blendMode: string,       // CSS globalCompositeOperation
 *   offscreen: OffscreenCanvas | null,
 * }
 */

export class LayerManager {
  constructor() {
    /** @type {Array<Object>} ordered bottom→top */
    this._layers = [];
    this._listeners = new Set();
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────────

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this.snapshot()));
  }

  snapshot() {
    return this._layers.map(({ offscreen: _o, ...rest }) => ({ ...rest }));
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  addLayer({ name, width = 2000, height = 2000 } = {}) {
    const id = createLayerId();
    const offscreen = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : null;
    const layer = {
      id,
      name: name ?? `Layer ${this._layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      offscreen,
    };
    this._layers.push(layer);
    this._emit();
    return id;
  }

  removeLayer(id) {
    const idx = this._layers.findIndex((l) => l.id === id);
    if (idx === -1) return;
    this._layers.splice(idx, 1);
    this._emit();
  }

  getLayer(id) {
    return this._layers.find((l) => l.id === id) ?? null;
  }

  getLayers() {
    return [...this._layers];
  }

  updateLayer(id, patch) {
    const layer = this.getLayer(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this._emit();
  }

  /** Move layer at fromIdx to toIdx (reorder) */
  moveLayer(fromIdx, toIdx) {
    const [layer] = this._layers.splice(fromIdx, 1);
    this._layers.splice(toIdx, 0, layer);
    this._emit();
  }

  /** Resize all offscreen canvases (e.g. on window resize) */
  resize(width, height) {
    for (const layer of this._layers) {
      if (layer.offscreen) {
        layer.offscreen.width = width;
        layer.offscreen.height = height;
      }
    }
    this._emit();
  }

  // ─── Serialization ───────────────────────────────────────────────────────────

  toJSON() {
    return this._layers.map(({ offscreen: _o, ...rest }) => ({ ...rest }));
  }

  fromJSON(layers) {
    this._layers = layers.map((l) => ({
      ...l,
      offscreen: typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(2000, 2000)
        : null,
    }));
    this._emit();
  }
}
