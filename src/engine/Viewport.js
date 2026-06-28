/**
 * Viewport.js
 * Manages the pan/zoom transform between world-space and screen-space.
 * All values are stored in plain JS — no React dependency.
 */

export class Viewport {
  constructor() {
    this.scale = 1;          // zoom level
    this.offsetX = 0;        // pan offset in screen pixels
    this.offsetY = 0;
    this.minScale = 0.05;
    this.maxScale = 40;
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
    return { scale: this.scale, offsetX: this.offsetX, offsetY: this.offsetY };
  }

  // ─── Pan ─────────────────────────────────────────────────────────────────────

  pan(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
    this._emit();
  }

  setOffset(x, y) {
    this.offsetX = x;
    this.offsetY = y;
    this._emit();
  }

  // ─── Zoom ────────────────────────────────────────────────────────────────────

  /**
   * Zoom centred on a screen-space point (cx, cy).
   * factor > 1 zooms in, factor < 1 zooms out.
   */
  zoomAt(factor, cx, cy) {
    const newScale = Math.min(
      this.maxScale,
      Math.max(this.minScale, this.scale * factor)
    );
    const scaleRatio = newScale / this.scale;
    // Adjust offset so the point under the cursor stays fixed
    this.offsetX = cx - scaleRatio * (cx - this.offsetX);
    this.offsetY = cy - scaleRatio * (cy - this.offsetY);
    this.scale = newScale;
    this._emit();
  }

  setScale(scale) {
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));
    this._emit();
  }

  reset() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._emit();
  }

  // ─── Coordinate Conversion ───────────────────────────────────────────────────

  /** Screen → World */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  /** World → Screen */
  worldToScreen(wx, wy) {
    return {
      x: wx * this.scale + this.offsetX,
      y: wy * this.scale + this.offsetY,
    };
  }

  /**
   * Apply this viewport's transform to a 2D canvas context.
   * Call this before drawing world-space geometry.
   */
  applyToContext(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  resetContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
