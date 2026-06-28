/**
 * Board.jsx
 * The main canvas host. Owns tool state and wires everything together.
 */

import React, { useRef, useState, useCallback } from 'react';
import { useCanvasEngine } from '../hooks/useCanvasEngine';
import Toolbar from './Toolbar';
import LayerPanel from './LayerPanel';
import ZoomControls from './ZoomControls';

const DEFAULT_TOOL_STATE = {
  tool: 'pen',
  color: '#ffffff',
  lineWidth: 3,
  opacity: 1,
};

export default function Board() {
  const canvasRef = useRef(null);
  const [toolState, setToolState] = useState(DEFAULT_TOOL_STATE);
  const [showLayers, setShowLayers] = useState(true);

  const { engine, viewport, layers, history, drawingHandlers } =
    useCanvasEngine(canvasRef, toolState);

  const setTool = useCallback((tool) => setToolState((s) => ({ ...s, tool })), []);
  const setColor = useCallback((color) => setToolState((s) => ({ ...s, color })), []);
  const setLineWidth = useCallback((lw) => setToolState((s) => ({ ...s, lineWidth: lw })), []);
  const setOpacity = useCallback((op) => setToolState((s) => ({ ...s, opacity: op })), []);

  return (
    <div className="board-root">
      {/* Top toolbar */}
      <Toolbar
        toolState={toolState}
        setTool={setTool}
        setColor={setColor}
        setLineWidth={setLineWidth}
        setOpacity={setOpacity}
        history={history}
        engine={engine}
        onToggleLayers={() => setShowLayers((v) => !v)}
        showLayers={showLayers}
      />

      {/* Canvas area */}
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="main-canvas"
          onPointerDown={drawingHandlers.onPointerDown}
          onPointerMove={drawingHandlers.onPointerMove}
          onPointerUp={drawingHandlers.onPointerUp}
          onPointerLeave={drawingHandlers.onPointerLeave}
          style={{ cursor: 'crosshair', touchAction: 'none' }}
        />

        {/* Zoom controls bottom-right */}
        <ZoomControls viewport={viewport} />

        {/* Viewport info */}
        <div className="viewport-info">
          {Math.round(viewport.scale * 100)}%
        </div>
      </div>

      {/* Layer panel */}
      {showLayers && (
        <LayerPanel layers={layers} engine={engine} />
      )}
    </div>
  );
}
