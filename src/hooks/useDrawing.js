/**
 * useDrawing.js
 * Handles pointer events and converts them into draw commands.
 * Supports: pen, eraser, line, rect, circle
 * Pan via Space+drag (no gesture lib).
 */

import { useRef, useCallback, useEffect } from 'react';
import { createId } from '../engine/ObjectStore';

export function useDrawing(engine, canvasRef, activeTool, toolOptions) {
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const currentObj = useRef(null);
  const spaceDown = useRef(false);

  // ─── Keyboard (Space for pan mode) ─────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceDown.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.shiftKey ? engine?.redo() : engine?.undo();
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        engine?.redo();
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [engine, canvasRef]);

  // ─── Mouse Wheel Zoom ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      engine.viewport.zoomAt(factor, cx, cy);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [engine, canvasRef]);

  // ─── Pointer Helpers ────────────────────────────────────────────────────────

  const getWorldPos = useCallback(
    (e) => {
      if (!engine || !canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return engine.viewport.screenToWorld(sx, sy);
    },
    [engine, canvasRef]
  );

  const getScreenPos = useCallback(
    (e) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [canvasRef]
  );

  // ─── Pointer Down ───────────────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e) => {
      if (!engine) return;
      e.currentTarget.setPointerCapture(e.pointerId);

      // Pan mode
      if (spaceDown.current || e.button === 1) {
        isPanning.current = true;
        const sp = getScreenPos(e);
        lastPan.current = sp;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;

      isDrawing.current = true;
      const wp = getWorldPos(e);
      const layerId = engine.activeLayerId;
      if (!layerId) return;

      const obj = {
        id: createId(),
        layerId,
        tool: activeTool,
        color: toolOptions.color,
        lineWidth: toolOptions.lineWidth,
        opacity: toolOptions.opacity ?? 1,
        points: [{ x: wp.x, y: wp.y }],
        startX: wp.x,
        startY: wp.y,
        endX: wp.x,
        endY: wp.y,
        createdAt: Date.now(),
      };
      currentObj.current = obj;
      engine.renderer.setScratchObject({ ...obj });
    },
    [engine, activeTool, toolOptions, getWorldPos, getScreenPos, canvasRef]
  );

  // ─── Pointer Move ───────────────────────────────────────────────────────────

  const onPointerMove = useCallback(
    (e) => {
      if (!engine) return;

      // Pan
      if (isPanning.current) {
        const sp = getScreenPos(e);
        engine.viewport.pan(
          sp.x - lastPan.current.x,
          sp.y - lastPan.current.y
        );
        lastPan.current = sp;
        return;
      }

      if (!isDrawing.current || !currentObj.current) return;

      const wp = getWorldPos(e);

      if (activeTool === 'pen' || activeTool === 'eraser') {
        // Append point
        currentObj.current.points.push({ x: wp.x, y: wp.y });
      } else {
        // Shape tools: update end point only
        currentObj.current.endX = wp.x;
        currentObj.current.endY = wp.y;
      }

      engine.renderer.setScratchObject({ ...currentObj.current });
    },
    [engine, activeTool, getWorldPos, getScreenPos]
  );

  // ─── Pointer Up ─────────────────────────────────────────────────────────────

  const onPointerUp = useCallback(
    (e) => {
      if (!engine) return;

      if (isPanning.current) {
        isPanning.current = false;
        if (canvasRef.current)
          canvasRef.current.style.cursor = spaceDown.current ? 'grab' : 'crosshair';
        return;
      }

      if (!isDrawing.current || !currentObj.current) return;
      isDrawing.current = false;

      const finalObj = { ...currentObj.current };
      currentObj.current = null;
      engine.renderer.clearScratch();

      // Ignore tiny accidental clicks for shape tools
      if (
        (activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') &&
        Math.abs(finalObj.endX - finalObj.startX) < 2 &&
        Math.abs(finalObj.endY - finalObj.startY) < 2
      ) {
        return;
      }

      // Push as undoable command
      engine.history.push({
        label: `Draw ${activeTool}`,
        execute: () => {
          engine.store.add(finalObj);
          engine.renderer.markDirty();
        },
        undo: () => {
          engine.store.remove(finalObj.id);
          engine.renderer.markDirty();
        },
      });
    },
    [engine, activeTool, canvasRef]
  );

  // ─── Pointer Leave ──────────────────────────────────────────────────────────

  const onPointerLeave = useCallback(() => {
    if (isDrawing.current) {
      // Commit what we have so far
      onPointerUp({ button: 0 });
    }
  }, [onPointerUp]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}
