/**
 * useCanvasEngine.js
 * Master hook — initialises the CanvasEngine when the canvas ref is ready,
 * and exposes all sub-hooks in a single object.
 *
 * Usage:
 *   const engine = useCanvasEngine(canvasRef, { tool, color, lineWidth });
 */

import { useRef, useEffect, useState } from 'react';
import { CanvasEngine } from '../engine/CanvasEngine';
import { useViewport } from './useViewport';
import { useLayers } from './useLayers';
import { useHistory } from './useHistory';
import { useDrawing } from './useDrawing';

export function useCanvasEngine(canvasRef, toolState) {
  const engineRef = useRef(null);
  const [engine, setEngine] = useState(null);

  // ── Bootstrap engine when canvas is mounted ───────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const eng = new CanvasEngine(canvas);
    engineRef.current = eng;

    // Initial size
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      eng.resize(width, height);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    setEngine(eng);

    return () => {
      ro.disconnect();
      eng.destroy();
      engineRef.current = null;
    };
  }, [canvasRef]);

  // ── Sub-hooks ────────────────────────────────────────────────────────────
  const viewport = useViewport(engine);
  const layers = useLayers(engine);
  const history = useHistory(engine);
  const drawingHandlers = useDrawing(
    engine,
    canvasRef,
    toolState.tool,
    {
      color: toolState.color,
      lineWidth: toolState.lineWidth,
      opacity: toolState.opacity ?? 1,
    }
  );

  return {
    engine,
    engineRef,
    viewport,
    layers,
    history,
    drawingHandlers,
  };
}
