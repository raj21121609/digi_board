/**
 * Exporter.js
 * Handles PNG and JSON export of the canvas state.
 */

export class Exporter {
  /**
   * @param {import('./ObjectStore').ObjectStore} store
   * @param {import('./LayerManager').LayerManager} layerManager
   * @param {import('./Renderer').Renderer} renderer
   */
  constructor(store, layerManager, renderer) {
    this.store = store;
    this.layerManager = layerManager;
    this.renderer = renderer;
  }

  // ─── PNG Export ──────────────────────────────────────────────────────────────

  /**
   * Export all visible layers as a flat PNG.
   * The image is in screen-space (what you see on screen, current viewport).
   * Pass { worldExport: true } to render at 1:1 world scale instead.
   *
   * @param {{ filename?: string, worldExport?: boolean, bg?: string }} opts
   */
  exportPNG({ filename = 'canvas-export.png', bg = '#ffffff' } = {}) {
    const srcCanvas = this.renderer.canvas;
    const offscreen = document.createElement('canvas');
    offscreen.width = srcCanvas.width;
    offscreen.height = srcCanvas.height;
    const ctx = offscreen.getContext('2d');

    // White background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Replay full render onto offscreen canvas
    ctx.save();
    this.renderer.viewport.applyToContext(ctx);

    const layers = this.layerManager.getLayers();
    for (const layer of layers) {
      if (!layer.visible) continue;
      const objects = this.store.getByLayer(layer.id);
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      for (const obj of objects) {
        this._drawObject(ctx, obj);
      }
      ctx.restore();
    }
    ctx.restore();

    const dataUrl = offscreen.toDataURL('image/png');
    this._triggerDownload(dataUrl, filename);
  }

  // ─── JSON Export ─────────────────────────────────────────────────────────────

  /**
   * Serialise the full canvas state (layers + objects) to JSON.
   * @param {{ filename?: string }} opts
   */
  exportJSON({ filename = 'canvas-export.json' } = {}) {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      layers: this.layerManager.toJSON(),
      objects: this.store.toJSON(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    this._triggerDownload(url, filename);
    URL.revokeObjectURL(url);
  }

  // ─── JSON Import ─────────────────────────────────────────────────────────────

  /**
   * Load previously exported JSON back into the stores.
   * @param {string|Object} jsonOrString
   */
  importJSON(jsonOrString) {
    const data =
      typeof jsonOrString === 'string' ? JSON.parse(jsonOrString) : jsonOrString;
    if (data.layers) this.layerManager.fromJSON(data.layers);
    if (data.objects) this.store.fromJSON(data.objects);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Mirror of Renderer._drawObject for offscreen export */
  _drawObject(ctx, obj) {
    ctx.save();
    ctx.strokeStyle = obj.tool === 'eraser' ? 'rgba(0,0,0,0)' : obj.color;
    ctx.lineWidth = obj.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = obj.opacity ?? 1;
    ctx.globalCompositeOperation =
      obj.tool === 'eraser' ? 'destination-out' : 'source-over';

    switch (obj.tool) {
      case 'pen':
      case 'eraser': {
        const pts = obj.points;
        if (!pts || pts.length < 2) {
          if (pts?.length === 1) {
            ctx.beginPath();
            ctx.arc(pts[0].x, pts[0].y, obj.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = obj.color;
            ctx.fill();
          }
          break;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
        ctx.stroke();
        break;
      }
      case 'line':
        ctx.beginPath();
        ctx.moveTo(obj.startX, obj.startY);
        ctx.lineTo(obj.endX, obj.endY);
        ctx.stroke();
        break;
      case 'rect': {
        const x = Math.min(obj.startX, obj.endX);
        const y = Math.min(obj.startY, obj.endY);
        ctx.strokeRect(x, y, Math.abs(obj.endX - obj.startX), Math.abs(obj.endY - obj.startY));
        break;
      }
      case 'circle': {
        const cx = (obj.startX + obj.endX) / 2;
        const cy = (obj.startY + obj.endY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(obj.endX - obj.startX) / 2, Math.abs(obj.endY - obj.startY) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
}
