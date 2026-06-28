/**
 * useViewport.js
 * React hook that subscribes to Viewport state changes.
 * Returns the current viewport snapshot and helper actions.
 */

import { useState, useEffect, useCallback } from 'react';

export function useViewport(engine) {
  const [state, setState] = useState(() =>
    engine ? engine.viewport.snapshot() : { scale: 1, offsetX: 0, offsetY: 0 }
  );

  useEffect(() => {
    if (!engine) return;
    setState(engine.viewport.snapshot());
    return engine.viewport.subscribe(setState);
  }, [engine]);

  const zoomAt = useCallback(
    (factor, cx, cy) => engine?.viewport.zoomAt(factor, cx, cy),
    [engine]
  );

  const pan = useCallback(
    (dx, dy) => engine?.viewport.pan(dx, dy),
    [engine]
  );

  const reset = useCallback(() => engine?.viewport.reset(), [engine]);

  const setScale = useCallback(
    (scale) => engine?.viewport.setScale(scale),
    [engine]
  );

  return { ...state, zoomAt, pan, reset, setScale };
}
