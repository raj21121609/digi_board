/**
 * ObjectStore.js
 * Stores all drawn objects (strokes, shapes) keyed by id.
 * Emits change events so subscribers can request a re-render.
 */

let _nextId = 1;

export function createId() {
  return `obj_${_nextId++}`;
}

/**
 * Object schema:
 * {
 *   id: string,
 *   layerId: string,
 *   tool: 'pen' | 'eraser' | 'line' | 'rect' | 'circle',
 *   color: string,
 *   lineWidth: number,
 *   opacity: number,
 *   points: Array<{x:number, y:number}>,   // world-space
 *   // For shapes: startX, startY, endX, endY
 *   startX?: number, startY?: number,
 *   endX?: number,   endY?: number,
 *   bbox: {x:number, y:number, w:number, h:number},
 *   createdAt: number,
 * }
 */

export class ObjectStore {
  constructor() {
    /** @type {Map<string, Object>} */
    this._objects = new Map();
    /** @type {Array<string>} ordered ids */
    this._order = [];
    this._listeners = new Set();
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────────

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(change) {
    this._listeners.forEach((fn) => fn(change));
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  add(obj) {
    if (!obj.id) obj.id = createId();
    obj.createdAt = obj.createdAt ?? Date.now();
    this._objects.set(obj.id, obj);
    this._order.push(obj.id);
    this._emit({ type: 'add', id: obj.id });
    return obj.id;
  }

  update(id, patch) {
    const obj = this._objects.get(id);
    if (!obj) return;
    Object.assign(obj, patch);
    this._emit({ type: 'update', id });
  }

  remove(id) {
    if (!this._objects.has(id)) return;
    this._objects.delete(id);
    this._order = this._order.filter((oid) => oid !== id);
    this._emit({ type: 'remove', id });
  }

  get(id) {
    return this._objects.get(id);
  }

  /** All objects on a given layer, in draw order */
  getByLayer(layerId) {
    return this._order
      .map((id) => this._objects.get(id))
      .filter((o) => o && o.layerId === layerId);
  }

  /** All objects, in draw order */
  getAll() {
    return this._order.map((id) => this._objects.get(id)).filter(Boolean);
  }

  clear(layerId) {
    const toRemove = layerId
      ? this._order.filter((id) => this._objects.get(id)?.layerId === layerId)
      : [...this._order];
    toRemove.forEach((id) => {
      this._objects.delete(id);
    });
    this._order = layerId
      ? this._order.filter((id) => !toRemove.includes(id))
      : [];
    this._emit({ type: 'clear', layerId });
  }

  // ─── Serialization ───────────────────────────────────────────────────────────

  toJSON() {
    return {
      order: [...this._order],
      objects: Object.fromEntries(this._objects),
    };
  }

  fromJSON({ order, objects }) {
    this._objects = new Map(Object.entries(objects));
    this._order = order;
    // Keep _nextId safe
    for (const id of order) {
      const n = parseInt(id.replace('obj_', ''), 10);
      if (!isNaN(n) && n >= _nextId) _nextId = n + 1;
    }
    this._emit({ type: 'load' });
  }
}
