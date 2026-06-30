import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Point, DrawnStroke, ToolType, ViewState } from '../hooks/useWhiteboard';
import type { GestureType, HandLandmark } from '../hooks/useHandTracking';
import { PRESET_COLORS } from './Toolbar';

interface CanvasProps {
  elements: DrawnStroke[];
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  addStroke: (points: Point[]) => void;
  moveElement: (id: string, dx: number, dy: number) => void;
  eraseAt: (x: number, y: number, radius?: number) => void;
  selectAt: (x: number, y: number) => DrawnStroke | null;
  currentGesture: GestureType;
  landmarks: HandLandmark[] | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  currentTool,
  setTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  selectedElementId,
  setSelectedElementId,
  viewState,
  setViewState,
  addStroke,
  moveElement,
  eraseAt,
  selectAt,
  currentGesture,
  landmarks,
  canvasRef,
}) => {
  const { pan, zoom } = viewState;
  
  // Interaction states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  
  const currentPointsRef = useRef<Point[]>([]);
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const lastWorldPosRef = useRef<Point>({ x: 0, y: 0 });

  // AI Gesture tracking states
  const lastGesturePosRef = useRef<Point | null>(null);
  const lastGestureRef = useRef<GestureType>('none');
  const activeStrokeFromGestureRef = useRef<Point[]>([]);

  // Get screen width/height for normalized hand landmarks mapping
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      setDimensions({ width: rect.width, height: rect.height });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef]);

  // Convert screen coords (clientX/Y) to canvas coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan, zoom, canvasRef]);

  // ----------------------------------------------------
  // DRAW CANVAS LOOP
  // ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw grid background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw infinite whiteboard grid pattern
    ctx.save();
    ctx.strokeStyle = 'rgba(229, 231, 235, 0.5)'; // Grid dot/line color
    ctx.lineWidth = 1;
    
    const gridSize = 40;
    const startX = pan.x % (gridSize * zoom);
    const startY = pan.y % (gridSize * zoom);

    // Draw vertical grid lines or dots
    for (let x = startX; x < canvas.width; x += gridSize * zoom) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSize * zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw Whiteboard elements with coordinates translation
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);

    elements.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Render highlight box if selected
      if (selectedElementId === stroke.id) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5 / zoom; // keep outline line thin
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        const pad = 6 / zoom;
        ctx.strokeRect(
          stroke.minX - pad,
          stroke.minY - pad,
          (stroke.maxX - stroke.minX) + pad * 2,
          (stroke.maxY - stroke.minY) + pad * 2
        );
        
        // Draw resize / pivot anchors at bounding box corners
        ctx.fillStyle = '#2563eb';
        const anchorSize = 6 / zoom;
        ctx.fillRect(stroke.minX - pad - anchorSize/2, stroke.minY - pad - anchorSize/2, anchorSize, anchorSize);
        ctx.fillRect(stroke.maxX + pad - anchorSize/2, stroke.minY - pad - anchorSize/2, anchorSize, anchorSize);
        ctx.fillRect(stroke.minX - pad - anchorSize/2, stroke.maxY + pad - anchorSize/2, anchorSize, anchorSize);
        ctx.fillRect(stroke.maxX + pad - anchorSize/2, stroke.maxY + pad - anchorSize/2, anchorSize, anchorSize);
        ctx.restore();
      }
    });

    // Render active drawing stroke (mouse)
    if (isDrawing && currentPointsRef.current.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentPointsRef.current[0].x, currentPointsRef.current[0].y);
      for (let i = 1; i < currentPointsRef.current.length; i++) {
        ctx.lineTo(currentPointsRef.current[i].x, currentPointsRef.current[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Render active drawing stroke (gesture)
    if (activeStrokeFromGestureRef.current.length > 1) {
      ctx.beginPath();
      ctx.moveTo(activeStrokeFromGestureRef.current[0].x, activeStrokeFromGestureRef.current[0].y);
      for (let i = 1; i < activeStrokeFromGestureRef.current.length; i++) {
        ctx.lineTo(activeStrokeFromGestureRef.current[i].x, activeStrokeFromGestureRef.current[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    ctx.restore();

    // Render AI Floating Pointer Circle overlay if hand landmarks are available
    if (landmarks && landmarks.length > 8) {
      const indexTip = landmarks[8];
      const screenX = indexTip.x * dimensions.width;
      const screenY = indexTip.y * dimensions.height;

      ctx.save();
      ctx.beginPath();
      ctx.arc(screenX, screenY, 14, 0, 2 * Math.PI);
      
      // Select cursor colors based on the current active gesture
      let gestureColor = 'rgba(59, 130, 246, 0.8)'; // default blue
      let actionLabel = 'Searching...';

      if (currentGesture === 'Index Finger') {
        gestureColor = 'rgba(16, 185, 129, 0.9)'; // emerald
        actionLabel = 'Drawing';
      } else if (currentGesture === 'Open Palm') {
        gestureColor = 'rgba(239, 68, 68, 0.9)'; // rose
        actionLabel = 'Erasing';
      } else if (currentGesture === 'Closed Fist') {
        gestureColor = 'rgba(245, 158, 11, 0.9)'; // amber
        actionLabel = 'Stop Drawing';
      } else if (currentGesture === 'Peace Sign') {
        gestureColor = 'rgba(139, 92, 246, 0.9)'; // violet
        actionLabel = 'Selecting';
      } else if (currentGesture === 'Pinch') {
        gestureColor = 'rgba(236, 72, 153, 0.9)'; // pink
        actionLabel = 'Dragging';
      } else if (currentGesture === 'Three Fingers') {
        gestureColor = 'rgba(59, 130, 246, 0.9)'; // blue
        actionLabel = 'Color Change';
      }

      ctx.strokeStyle = gestureColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = gestureColor;
      ctx.fill();

      // Gesture Action Text Overlay
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px Inter, sans-serif';
      const labelText = `${actionLabel}`;
      const textWidth = ctx.measureText(labelText).width;
      
      // Draw background panel for text
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = gestureColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(screenX + 20, screenY - 12, textWidth + 14, 20, 6);
      ctx.fill();
      ctx.stroke();

      // Draw active text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, screenX + 27, screenY + 2);

      ctx.restore();
    }
  }, [
    elements,
    pan,
    zoom,
    selectedElementId,
    isDrawing,
    strokeColor,
    strokeWidth,
    landmarks,
    currentGesture,
    dimensions,
    canvasRef
  ]);

  // ----------------------------------------------------
  // GESTURE (AI HAND LANDMARKS) ACTIONS LOGIC
  // ----------------------------------------------------
  useEffect(() => {
    if (!landmarks || landmarks.length <= 8) {
      // Clear gesture stroke if hand leaves camera view
      if (activeStrokeFromGestureRef.current.length > 0) {
        addStroke(activeStrokeFromGestureRef.current);
        activeStrokeFromGestureRef.current = [];
      }
      lastGesturePosRef.current = null;
      lastGestureRef.current = 'None';
      return;
    }

    const indexTip = landmarks[8];
    const screenX = indexTip.x * dimensions.width;
    const screenY = indexTip.y * dimensions.height;
    
    // Get world coords for drawing
    const worldPos = getCanvasCoords(screenX, screenY);

    // Track transitions between gesture states
    const prevGesture = lastGestureRef.current;
    
    // 1. Pencil Tool Drawing Gestures
    if (currentGesture === 'Index Finger') {
      if (prevGesture !== 'Index Finger') {
        // Start drawing stroke
        activeStrokeFromGestureRef.current = [worldPos];
      } else {
        // Add point to stroke
        activeStrokeFromGestureRef.current.push(worldPos);
      }
    } else {
      // Finished drawing stroke, save it
      if (activeStrokeFromGestureRef.current.length > 0) {
        addStroke(activeStrokeFromGestureRef.current);
        activeStrokeFromGestureRef.current = [];
      }
    }

    // 2. Eraser Gestures
    if (currentGesture === 'Open Palm') {
      eraseAt(worldPos.x, worldPos.y, 25); // wider radius for ease
    }

    // 3. Selection and Dragging Gestures
    if (currentGesture === 'Peace Sign') {
      // Choose tool as 'select' if it is not selected
      if (currentTool !== 'select') {
        setTool('select');
      }
      // Click at current screen coords to select elements
      if (prevGesture !== 'Peace Sign') {
        selectAt(worldPos.x, worldPos.y);
      }
    }

    // Pinch selection dragging
    if (currentGesture === 'Pinch') {
      if (selectedElementId && lastGesturePosRef.current) {
        const dx = worldPos.x - lastGesturePosRef.current.x;
        const dy = worldPos.y - lastGesturePosRef.current.y;
        moveElement(selectedElementId, dx, dy);
      }
    }

    // 4. Stop Drawing Gesture
    if (currentGesture === 'Closed Fist') {
      // Intentionally does nothing. The transition away from "Index Finger" 
      // automatically finalizes the current stroke in block #1 above.
    }

    // 5. Color Change
    if (currentGesture === 'Three Fingers') {
      if (prevGesture !== 'Three Fingers') {
        const currentIndex = PRESET_COLORS.indexOf(strokeColor);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PRESET_COLORS.length;
        setStrokeColor(PRESET_COLORS[nextIndex]);
      }
    }

    // Update gesture history references
    lastGesturePosRef.current = worldPos;
    lastGestureRef.current = currentGesture;

  }, [landmarks, currentGesture, dimensions, getCanvasCoords, addStroke, eraseAt, selectedElementId, moveElement, setViewState, currentTool, setTool, selectAt, strokeColor, setStrokeColor]);


  // ----------------------------------------------------
  // MOUSE & TOUCH EVENT HANDLERS
  // ----------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    // Left click handling
    if (e.button === 0) {
      const worldPos = getCanvasCoords(e.clientX, e.clientY);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      lastWorldPosRef.current = worldPos;

      if (currentTool === 'pencil') {
        setIsDrawing(true);
        currentPointsRef.current = [worldPos];
      } else if (currentTool === 'eraser') {
        setIsDrawing(true);
        eraseAt(worldPos.x, worldPos.y, strokeWidth * 2);
      } else if (currentTool === 'select') {
        const clicked = selectAt(worldPos.x, worldPos.y);
        if (clicked) {
          setIsDraggingElement(true);
        } else {
          setSelectedElementId(null);
        }
      }
    } 
    // Middle click or space+click handling for panning
    else if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPos = getCanvasCoords(e.clientX, e.clientY);

    if (isDrawing) {
      if (currentTool === 'pencil') {
        currentPointsRef.current.push(worldPos);
      } else if (currentTool === 'eraser') {
        eraseAt(worldPos.x, worldPos.y, strokeWidth * 2);
      }
      // Trigger canvas re-render
      setViewState(prev => ({ ...prev }));
    } else if (isDraggingElement && selectedElementId) {
      const dx = worldPos.x - lastWorldPosRef.current.x;
      const dy = worldPos.y - lastWorldPosRef.current.y;
      moveElement(selectedElementId, dx, dy);
      lastWorldPosRef.current = worldPos;
    } else if (isPanning) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setViewState((prev) => ({
        ...prev,
        pan: { x: prev.pan.x + dx, y: prev.pan.y + dy },
      }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 0) {
      if (isDrawing && currentTool === 'pencil' && currentPointsRef.current.length > 0) {
        addStroke(currentPointsRef.current);
        currentPointsRef.current = [];
      }
      setIsDrawing(false);
      setIsDraggingElement(false);
    } else if (e.button === 1 || e.button === 2) {
      setIsPanning(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // disable right-click menu to support right-click panning
  };

  // Zooming Handler
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 1.08;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    const finalZoom = Math.min(12, Math.max(0.15, nextZoom));

    // Pan canvas adjustment to keep scale centered on mouse position
    const nextPan = {
      x: mouseX - (mouseX - pan.x) * (finalZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (finalZoom / zoom),
    };

    setViewState({
      zoom: finalZoom,
      pan: nextPan,
    });
  };

  return (
    <div className="relative flex-1 h-full w-full select-none overflow-hidden bg-grid-pattern bg-white dark:bg-slate-950">
      {/* HTML5 Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        className="block cursor-crosshair h-full w-full"
      />
    </div>
  );
};
