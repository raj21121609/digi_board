import { useState, useCallback } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface DrawnStroke {
  id: string;
  points: Point[];
  color: string;
  lineWidth: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ToolType = 'pencil' | 'eraser' | 'select';

export interface ViewState {
  pan: Point;
  zoom: number;
}

export function useWhiteboard() {
  const [elements, setElements] = useState<DrawnStroke[]>([]);
  const [history, setHistory] = useState<DrawnStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  const [currentTool, setCurrentTool] = useState<ToolType>('pencil');
  const [strokeColor, setStrokeColor] = useState<string>('#3b82f6'); // default blue
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  const [viewState, setViewState] = useState<ViewState>({
    pan: { x: 0, y: 0 },
    zoom: 1,
  });

  // Push new state to history for undo/redo
  const pushHistory = useCallback((newElements: DrawnStroke[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newElements]);
    setHistoryIndex(nextHistory.length);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
      setSelectedElementId(null);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setElements([]);
      setSelectedElementId(null);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setElements(history[nextIndex]);
      setSelectedElementId(null);
    }
  }, [history, historyIndex]);

  const clear = useCallback(() => {
    setElements([]);
    setSelectedElementId(null);
    pushHistory([]);
  }, [pushHistory]);

  const addStroke = useCallback((points: Point[]) => {
    if (points.length === 0) return;
    
    // Calculate bounding box
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    const newStroke: DrawnStroke = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      points,
      color: strokeColor,
      lineWidth: strokeWidth,
      minX,
      minY,
      maxX,
      maxY,
    };

    const updated = [...elements, newStroke];
    setElements(updated);
    pushHistory(updated);
  }, [elements, strokeColor, strokeWidth, pushHistory]);

  const moveElement = useCallback((id: string, dx: number, dy: number) => {
    setElements(prev => {
      const updated = prev.map(el => {
        if (el.id !== id) return el;
        const movedPoints = el.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        return {
          ...el,
          points: movedPoints,
          minX: el.minX + dx,
          minY: el.minY + dy,
          maxX: el.maxX + dx,
          maxY: el.maxY + dy,
        };
      });
      return updated;
    });
  }, []);

  // Erase stroke if pointer intersects with stroke bounding box or any points
  const eraseAt = useCallback((x: number, y: number, radius: number = 10) => {
    let affected = false;
    const updated = elements.filter(el => {
      // Fast bounding box reject with added buffer radius
      if (x < el.minX - radius || x > el.maxX + radius || y < el.minY - radius || y > el.maxY + radius) {
        return true;
      }
      // Check distance to points
      const hasClosePoint = el.points.some(pt => {
        const dx = pt.x - x;
        const dy = pt.y - y;
        return (dx * dx + dy * dy) <= radius * radius;
      });
      
      if (hasClosePoint) {
        affected = true;
        if (selectedElementId === el.id) {
          setSelectedElementId(null);
        }
        return false;
      }
      return true;
    });

    if (affected) {
      setElements(updated);
      pushHistory(updated);
    }
  }, [elements, selectedElementId, pushHistory]);

  const selectAt = useCallback((x: number, y: number) => {
    // Find matching elements by checking point distances (reversing to find top-most element first)
    const reversed = [...elements].reverse();
    const clickedElement = reversed.find(el => {
      // Check bounding box
      const threshold = 15;
      if (x < el.minX - threshold || x > el.maxX + threshold || y < el.minY - threshold || y > el.maxY + threshold) {
        return false;
      }
      // Check point distances
      return el.points.some(pt => {
        const dx = pt.x - x;
        const dy = pt.y - y;
        return (dx * dx + dy * dy) <= threshold * threshold;
      });
    });

    setSelectedElementId(clickedElement ? clickedElement.id : null);
    return clickedElement || null;
  }, [elements]);

  return {
    elements,
    setElements,
    currentTool,
    setCurrentTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    selectedElementId,
    setSelectedElementId,
    viewState,
    setViewState,
    undo,
    redo,
    clear,
    addStroke,
    moveElement,
    eraseAt,
    selectAt,
    pushHistory,
  };
}
