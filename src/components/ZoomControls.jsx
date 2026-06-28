/**
 * ZoomControls.jsx
 * Floating zoom control buttons (zoom in/out/reset).
 */

import React from 'react';

export default function ZoomControls({ viewport }) {
  const { scale, zoomAt, reset } = viewport;

  // Zoom centred on the canvas middle
  const zoomIn  = () => zoomAt(1.25, window.innerWidth / 2, window.innerHeight / 2);
  const zoomOut = () => zoomAt(0.8,  window.innerWidth / 2, window.innerHeight / 2);

  return (
    <div className="zoom-controls" role="group" aria-label="Zoom controls">
      <button id="btn-zoom-in"  onClick={zoomIn}  className="zoom-btn" title="Zoom in">
        +
      </button>
      <button
        id="btn-zoom-reset"
        onClick={reset}
        className="zoom-btn zoom-level"
        title="Reset zoom"
      >
        {Math.round(scale * 100)}%
      </button>
      <button id="btn-zoom-out" onClick={zoomOut} className="zoom-btn" title="Zoom out">
        −
      </button>
    </div>
  );
}
