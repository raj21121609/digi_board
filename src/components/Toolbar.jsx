/**
 * Toolbar.jsx
 * Top toolbar: tools, color, brush size, opacity, undo/redo, export.
 */

import React from 'react';

const TOOLS = [
  { id: 'pen',    icon: '✏️', label: 'Pen' },
  { id: 'eraser', icon: '⬜', label: 'Eraser' },
  { id: 'line',   icon: '╱', label: 'Line' },
  { id: 'rect',   icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Ellipse' },
];

export default function Toolbar({
  toolState,
  setTool,
  setColor,
  setLineWidth,
  setOpacity,
  history,
  engine,
  onToggleLayers,
  showLayers,
}) {
  return (
    <header className="toolbar" role="toolbar" aria-label="Drawing toolbar">
      {/* Brand */}
      <div className="toolbar-brand">
        <span className="toolbar-logo">◈</span>
        <span className="toolbar-title">DigiBoard</span>
      </div>

      <div className="toolbar-divider" />

      {/* Tool buttons */}
      <div className="toolbar-group" role="group" aria-label="Drawing tools">
        {TOOLS.map(({ id, icon, label }) => (
          <button
            key={id}
            id={`tool-${id}`}
            title={label}
            aria-label={label}
            aria-pressed={toolState.tool === id}
            className={`tool-btn ${toolState.tool === id ? 'active' : ''}`}
            onClick={() => setTool(id)}
          >
            <span className="tool-icon">{icon}</span>
            <span className="tool-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Color + brush */}
      <div className="toolbar-group" aria-label="Brush settings">
        <label className="setting-group" title="Color">
          <span className="setting-label">Color</span>
          <input
            id="color-picker"
            type="color"
            value={toolState.color}
            onChange={(e) => setColor(e.target.value)}
            className="color-input"
          />
        </label>

        <label className="setting-group" title="Brush size">
          <span className="setting-label">Size&nbsp;{toolState.lineWidth}px</span>
          <input
            id="brush-size"
            type="range"
            min="1"
            max="80"
            value={toolState.lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="range-input"
          />
        </label>

        <label className="setting-group" title="Opacity">
          <span className="setting-label">
            Opacity&nbsp;{Math.round(toolState.opacity * 100)}%
          </span>
          <input
            id="opacity-slider"
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={toolState.opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="range-input"
          />
        </label>
      </div>

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <div className="toolbar-group" aria-label="History">
        <button
          id="btn-undo"
          title={history.undoLabel ? `Undo: ${history.undoLabel}` : 'Undo'}
          disabled={!history.canUndo}
          onClick={() => engine?.undo()}
          className="action-btn"
        >
          ↩ Undo
        </button>
        <button
          id="btn-redo"
          title={history.redoLabel ? `Redo: ${history.redoLabel}` : 'Redo'}
          disabled={!history.canRedo}
          onClick={() => engine?.redo()}
          className="action-btn"
        >
          ↪ Redo
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Export */}
      <div className="toolbar-group" aria-label="Export">
        <button
          id="btn-export-png"
          title="Export as PNG"
          onClick={() => engine?.exportPNG()}
          className="action-btn export-btn"
        >
          ⬇ PNG
        </button>
        <button
          id="btn-export-json"
          title="Export as JSON"
          onClick={() => engine?.exportJSON()}
          className="action-btn export-btn"
        >
          ⬇ JSON
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Layers toggle */}
      <button
        id="btn-toggle-layers"
        title="Toggle layer panel"
        onClick={onToggleLayers}
        aria-pressed={showLayers}
        className={`action-btn layers-toggle ${showLayers ? 'active' : ''}`}
      >
        ☰ Layers
      </button>
    </header>
  );
}
