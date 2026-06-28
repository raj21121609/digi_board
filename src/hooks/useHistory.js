/**
 * useHistory.js
 * React hook that subscribes to HistoryManager state (canUndo, canRedo, etc.)
 */

import { useState, useEffect } from 'react';

export function useHistory(engine) {
  const [state, setState] = useState({
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
    undoCount: 0,
    redoCount: 0,
  });

  useEffect(() => {
    if (!engine) return;
    setState(engine.history.snapshot());
    return engine.history.subscribe(setState);
  }, [engine]);

  return state;
}
