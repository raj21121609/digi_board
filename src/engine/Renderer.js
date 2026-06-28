/**
 * Renderer.js
 * Composites all layer objects onto a visible <canvas> element.
 * Reads from ObjectStore + LayerManager, applies Viewport transform.
 */

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas  — the main visible canvas
   * @param {import('./ObjectStore').ObjectStore} store
   * @param {import('./LayerManager').LayerManager} layerManager
   * @param {import('./Viewport').Viewport} viewport
   */
  constructor(canvas, store, layerManager, viewport) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.layerManager = layerManager;
    this.viewport = viewport;
    this._raf = null;
    this._dirty = true;
    /** Scratch canvas for in-progress strokes */
    this.scratchCanvas = document.createElement('canvas');
    this.scratchCanvas.width = canvas.width;
    this.scratchCanvas.height = canvas.height;
    this.scratchCtx = this.scratchCanvas.getContext('2d');
    this._currentStrokeObj = null;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.scratchCanvas.width = width;
    this.scratchCanvas.height = height;
    this.markDirty();
  }

  markDirty() {
    this._dirty = true;
    if (!this._raf) {
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        if (this._dirty) this.render();
      });
    }
  }

  // ─── Drawing Helpers ─────────────────────────────────────────────────────────

  _applyStyle(ctx, obj) {
    ctx.strokeStyle = obj.tool === 'eraser' ? 'rgba(0,0,0,0)' : obj.color;
    ctx.lineWidth = obj.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = obj.opacity ?? 1;
    ctx.globalCompositeOperation =
      obj.tool === 'eraser' ? 'destination-out' : 'source-over';
  }

  _drawObject(ctx, obj) {
    ctx.save();
    this._applyStyle(ctx, obj);

    switch (obj.tool) {
      case 'pen':
      case 'eraser':
        this._drawStroke(ctx, obj.points);
        break;
      case 'line':
        this._drawLine(ctx, obj);
        break;
      case 'rect':
        this._drawRect(ctx, obj);
        break;
      case 'circle':
        this._drawCircle(ctx, obj);
        break;
      default:
        break;
    }
    ctx.restore();
  }

  _drawStroke(ctx, points) {
    if (!points || points.length < 2) {
      if (points?.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    ctx.lineTo(points.at(-1).x, points.at(-1).y);
    ctx.stroke();
  }

  _drawLine(ctx, obj) {
    ctx.beginPath();
    ctx.moveTo(obj.startX, obj.startY);
    ctx.lineTo(obj.endX, obj.endY);
    ctx.stroke();
  }

  _drawRect(ctx, obj) {
    const x = Math.min(obj.startX, obj.endX);
    const y = Math.min(obj.startY, obj.endY);
    const w = Math.abs(obj.endX - obj.startX);
    const h = Math.abs(obj.endY - obj.startY);
    ctx.strokeRect(x, y, w, h);
  }

  _drawCircle(ctx, obj) {
    const cx = (obj.startX + obj.endX) / 2;
    const cy = (obj.startY + obj.endY) / 2;
    const rx = Math.abs(obj.endX - obj.startX) / 2;
    const ry = Math.abs(obj.endY - obj.startY) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ─── Scratch (In-Progress Stroke) ────────────────────────────────────────────

  /** Set/update the active in-progress stroke object (not yet in store) */
  setScratchObject(obj) {
    this._currentStrokeObj = obj;
    this.markDirty();
  }

  clearScratch() {
    this._currentStrokeObj = null;
    this.scratchCtx.clearRect(0, 0, this.scratchCanvas.width, this.scratchCanvas.height);
    this.markDirty();
  }

  _renderScratch() {
    const { scratchCtx: ctx } = this;
    ctx.clearRect(0, 0, this.scratchCanvas.width, this.scratchCanvas.height);
    if (!this._currentStrokeObj) return;
    ctx.save();
    this.viewport.applyToContext(ctx);
    this._drawObject(ctx, this._currentStrokeObj);
    ctx.restore();
  }

  // ─── Main Render ─────────────────────────────────────────────────────────────

  render() {
    this._dirty = false;
    const { ctx, canvas } = this;
    const { width, height } = canvas;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw infinite grid
    this._drawGrid(ctx);

    // Apply viewport transform
    ctx.save();
    this.viewport.applyToContext(ctx);

    // Composite each visible layer bottom→top
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

    // Render scratch on top (already has its own transform)
    this._renderScratch();
    ctx.drawImage(this.scratchCanvas, 0, 0);
  }

  // ─── Grid ────────────────────────────────────────────────────────────────────

  _drawGrid(ctx) {
    const { scale, offsetX, offsetY } = this.viewport;
    const { width, height } = this.canvas;

    // Pick a grid spacing that stays readable across zoom levels
    let gridSize = 40;
    while (gridSize * scale < 20) gridSize *= 2;
    while (gridSize * scale > 120) gridSize /= 2;

    const dotSize = 1.2;
    const startX = (((-offsetX / scale) % gridSize) + gridSize) % gridSize;
    const startY = (((-offsetY / scale) % gridSize) + gridSize) % gridSize;

    ctx.save();
    ctx.fillStyle = 'rgba(148,163,184,0.35)';

    for (let x = -startX; x < width / scale; x += gridSize) {
      for (let y = -startY; y < height / scale; y += gridSize) {
        const sx = x * scale + offsetX;
        const sy = y * scale + offsetY;
        ctx.beginPath();
        ctx.arc(sx, sy, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
