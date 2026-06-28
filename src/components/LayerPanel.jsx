/**
 * LayerPanel.jsx
 * Sidebar panel listing all layers with visibility/lock toggles, add/remove.
 */

import React, { useState } from 'react';

export default function LayerPanel({ layers, engine }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const activeLayerId = engine?.activeLayerId;

  const handleAdd = () => {
    engine && layers.addLayer({ name: `Layer ${layers.layers.length + 1}` });
  };

  const handleRemove = (id) => {
    if (layers.layers.length <= 1) return; // always keep ≥1 layer
    layers.removeLayer(id);
  };

  const handleVisibility = (id, visible) => {
    layers.updateLayer(id, { visible: !visible });
  };

  const handleLock = (id, locked) => {
    layers.updateLayer(id, { locked: !locked });
  };

  const startRename = (id, name) => {
    setEditingId(id);
    setEditName(name);
  };

  const commitRename = (id) => {
    if (editName.trim()) layers.updateLayer(id, { name: editName.trim() });
    setEditingId(null);
  };

  // Render layers top→bottom (reverse display order)
  const displayLayers = [...(layers.layers ?? [])].reverse();

  return (
    <aside className="layer-panel" aria-label="Layer panel">
      <div className="layer-panel-header">
        <span className="panel-title">Layers</span>
        <button
          id="btn-add-layer"
          className="icon-btn"
          title="Add layer"
          onClick={handleAdd}
        >
          +
        </button>
      </div>

      <ul className="layer-list" role="list">
        {displayLayers.map((layer) => (
          <li
            key={layer.id}
            className={`layer-item ${layer.id === activeLayerId ? 'active' : ''}`}
            onClick={() => layers.setActiveLayer(layer.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === 'Enter' && layers.setActiveLayer(layer.id)
            }
          >
            {/* Visibility toggle */}
            <button
              className={`layer-icon-btn vis-btn ${layer.visible ? 'on' : 'off'}`}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
              onClick={(e) => {
                e.stopPropagation();
                handleVisibility(layer.id, layer.visible);
              }}
              aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? '👁' : '🚫'}
            </button>

            {/* Layer name */}
            {editingId === layer.id ? (
              <input
                className="layer-name-input"
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitRename(layer.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(layer.id);
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="layer-name"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(layer.id, layer.name);
                }}
                title="Double-click to rename"
              >
                {layer.name}
              </span>
            )}

            {/* Lock toggle */}
            <button
              className={`layer-icon-btn lock-btn ${layer.locked ? 'locked' : ''}`}
              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              onClick={(e) => {
                e.stopPropagation();
                handleLock(layer.id, layer.locked);
              }}
              aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
            >
              {layer.locked ? '🔒' : '🔓'}
            </button>

            {/* Opacity slider */}
            <input
              type="range"
              className="layer-opacity"
              min="0"
              max="1"
              step="0.05"
              value={layer.opacity}
              title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                layers.updateLayer(layer.id, { opacity: Number(e.target.value) });
              }}
            />

            {/* Delete */}
            <button
              className="layer-icon-btn del-btn"
              title="Delete layer"
              disabled={layers.layers?.length <= 1}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(layer.id);
              }}
              aria-label="Delete layer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="layer-panel-hint">
        Double-click name to rename
      </div>
    </aside>
  );
}
