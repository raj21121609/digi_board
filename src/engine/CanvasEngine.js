/**
 * CanvasEngine.js
 * Top-level coordinator — instantiates all sub-modules and wires them together.
 * This is the single object that React will hold in a ref.
 */

import { Viewport } from './Viewport';
import { ObjectStore } from './ObjectStore';
import { LayerManager } from './LayerManager';
import { HistoryManager } from './HistoryManager';
import { Renderer } from './Renderer';
import { Exporter } from './Exporter';

export class CanvasEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Core sub-modules
    this.viewport = new Viewport();
    this.store = new ObjectStore();
    this.layerManager = new LayerManager();
    this.history = new HistoryManager();
    this.renderer = new Renderer(canvas, this.store, this.layerManager, this.viewport);
    this.exporter = new Exporter(this.store, this.layerManager, this.renderer);

    // Add a default layer
    this._activeLayerId = this.layerManager.addLayer({ name: 'Layer 1' });

    // Wire change events → dirty flag
    this.store.subscribe(() => this.renderer.markDirty());
    this.layerManager.subscribe(() => this.renderer.markDirty());
    this.viewport.subscribe(() => this.renderer.markDirty());

    // Initial render
    this.renderer.markDirty();
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  get activeLayerId() {
    return this._activeLayerId;
  }

  setActiveLayer(id) {
    this._activeLayerId = id;
  }

  // ─── Resize ──────────────────────────────────────────────────────────────────

  resize(width, height) {
    this.renderer.resize(width, height);
  }

  // ─── History helpers ─────────────────────────────────────────────────────────

  undo() {
    this.history.undo();
    this.renderer.markDirty();
  }

  redo() {
    this.history.redo();
    this.renderer.markDirty();
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  exportPNG(opts) {
    this.exporter.exportPNG(opts);
  }

  exportJSON(opts) {
    this.exporter.exportJSON(opts);
  }

  importJSON(data) {
    this.exporter.importJSON(data);
    this.renderer.markDirty();
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  destroy() {
    this.renderer.destroy();
  }
}
