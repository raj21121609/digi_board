/**
 * useLayers.js
 * React hook that subscribes to LayerManager state.
 * Returns the current layer list and CRUD actions (wrapped in undo/redo commands).
 */

import { useState, useEffect, useCallback } from 'react';

export function useLayers(engine) {
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerIdState] = useState(null);

  useEffect(() => {
    if (!engine) return;
    setLayers(engine.layerManager.snapshot());
    setActiveLayerIdState(engine.activeLayerId);
    const unsub = engine.layerManager.subscribe((snap) => setLayers(snap));
    return unsub;
  }, [engine]);

  const addLayer = useCallback(
    (opts) => {
      if (!engine) return;
      let newId;
      engine.history.push({
        label: 'Add Layer',
        execute: () => {
          newId = engine.layerManager.addLayer(opts);
          engine.setActiveLayer(newId);
          setActiveLayerIdState(newId);
        },
        undo: () => {
          if (newId) {
            engine.store.clear(newId);
            engine.layerManager.removeLayer(newId);
            // Revert active layer to first available
            const remaining = engine.layerManager.getLayers();
            const fallback = remaining.at(-1)?.id ?? null;
            engine.setActiveLayer(fallback);
            setActiveLayerIdState(fallback);
          }
        },
      });
    },
    [engine]
  );

  const removeLayer = useCallback(
    (id) => {
      if (!engine) return;
      const snap = engine.layerManager.getLayer(id);
      if (!snap) return;
      const objects = engine.store.getByLayer(id).map((o) => ({ ...o }));
      const wasActive = engine.activeLayerId === id;

      engine.history.push({
        label: 'Remove Layer',
        execute: () => {
          engine.store.clear(id);
          engine.layerManager.removeLayer(id);
          if (wasActive) {
            const remaining = engine.layerManager.getLayers();
            const fallback = remaining.at(-1)?.id ?? null;
            engine.setActiveLayer(fallback);
            setActiveLayerIdState(fallback);
          }
        },
        undo: () => {
          engine.layerManager.addLayer({ name: snap.name });
          // Restore objects
          objects.forEach((o) => engine.store.add({ ...o, layerId: id }));
          if (wasActive) {
            engine.setActiveLayer(id);
            setActiveLayerIdState(id);
          }
        },
      });
    },
    [engine]
  );

  const updateLayer = useCallback(
    (id, patch) => {
      if (!engine) return;
      const before = { ...engine.layerManager.getLayer(id) };
      engine.history.push({
        label: 'Update Layer',
        execute: () => engine.layerManager.updateLayer(id, patch),
        undo: () => engine.layerManager.updateLayer(id, before),
      });
    },
    [engine]
  );

  const setActiveLayer = useCallback(
    (id) => {
      if (!engine) return;
      engine.setActiveLayer(id);
      setActiveLayerIdState(id);
    },
    [engine]
  );

  const moveLayer = useCallback(
    (fromIdx, toIdx) => {
      if (!engine) return;
      engine.history.push({
        label: 'Move Layer',
        execute: () => engine.layerManager.moveLayer(fromIdx, toIdx),
        undo: () => engine.layerManager.moveLayer(toIdx, fromIdx),
      });
    },
    [engine]
  );

  return { layers, activeLayerId, addLayer, removeLayer, updateLayer, setActiveLayer, moveLayer };
}
