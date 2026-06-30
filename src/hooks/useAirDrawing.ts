/**
 * useAirDrawing.ts
 *
 * "Air drawing" — draw on a canvas by moving your index fingertip in the air.
 *
 * Behaviour (driven by the caller):
 *   • While `active` is true (only the index finger raised → 'pointing' gesture)
 *     and a fingertip `point` is available, the fingertip is appended to the
 *     CURRENT stroke.
 *   • When `active` goes false (finger lowered / hand gone / other gesture), the
 *     current stroke is finalised and stored, and the next pointing session
 *     starts a brand-new stroke.
 *
 * Every stroke is stored separately (array of {points,color,width}) so strokes
 * can be undone / cleared individually and re-rendered independently.
 *
 * Strokes are rendered with quadratic Bézier smoothing: the curve passes through
 * the midpoints between consecutive samples, using each sample as a control
 * point. This turns the jittery point cloud into a single smooth, flowing line.
 *
 * Coordinates are expected in the SAME canvas-pixel space the overlay uses
 * (i.e. the smoothed fingertip reported by useHandOverlay), so strokes line up
 * with the finger and the mirrored video when this canvas shares its transform.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AirPoint {
  x: number;
  y: number;
}

export interface AirStroke {
  /** Ordered fingertip samples that make up this stroke. */
  points: AirPoint[];
  color: string;
  width: number;
}

interface AirStyle {
  color?: string;
  width?: number;
}

export interface AirDrawingApi {
  /** Erase every stroke. */
  clear: () => void;
  /** Remove the most recently completed stroke. */
  undo: () => void;
  /** Number of completed (stored) strokes. */
  strokeCount: number;
  /** True while a stroke is actively being drawn. */
  isDrawing: boolean;
  /** Live ref to the stored strokes (each entry is one separate stroke). */
  strokes: React.RefObject<AirStroke[]>;
}

/** Minimum fingertip travel (px) before a new sample is recorded — drops dupes. */
const MIN_SAMPLE_DISTANCE = 1.2;

export function useAirDrawing(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  active: boolean,
  point: AirPoint | null,
  style: AirStyle = {}
): AirDrawingApi {
  const { color = '#22d3ee', width = 4 } = style;

  // Completed strokes — each is an independent entry. The in-progress stroke is
  // kept separate until it's finalised, then pushed here.
  const strokesRef = useRef<AirStroke[]>([]);
  const currentRef = useRef<AirStroke | null>(null);

  const [strokeCount, setStrokeCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);

  // ── Repaint the whole canvas from stored strokes + the in-progress one ──────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) drawSmoothStroke(ctx, stroke);
    if (currentRef.current) drawSmoothStroke(ctx, currentRef.current);
  }, [canvasRef]);

  // ── Sample the fingertip / finalise strokes as `active`/`point` change ──────
  useEffect(() => {
    if (active && point) {
      // Begin a new stroke on the rising edge of a pointing session.
      if (!currentRef.current) {
        currentRef.current = { points: [], color, width };
        setIsDrawing(true);
      }
      const pts = currentRef.current.points;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= MIN_SAMPLE_DISTANCE) {
        pts.push({ x: point.x, y: point.y });
      }
    } else if (currentRef.current) {
      // Finger lowered (or hand lost) → store this stroke separately and reset.
      if (currentRef.current.points.length > 0) {
        strokesRef.current.push(currentRef.current);
        setStrokeCount(strokesRef.current.length);
      }
      currentRef.current = null;
      setIsDrawing(false);
    }

    redraw();
  }, [active, point, color, width, redraw]);

  const clear = useCallback(() => {
    strokesRef.current = [];
    currentRef.current = null;
    setStrokeCount(0);
    setIsDrawing(false);
    redraw();
  }, [redraw]);

  const undo = useCallback(() => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  }, [redraw]);

  return { clear, undo, strokeCount, isDrawing, strokes: strokesRef };
}

// ─── Bézier rendering ─────────────────────────────────────────────────────────

/**
 * Draw a single stroke as a smooth quadratic Bézier path.
 *
 * For 3+ points we move through the midpoints of consecutive samples, using each
 * sample as the quadratic control point — the standard "midpoint smoothing"
 * technique that yields a continuous, low-jitter curve.
 */
function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  stroke: AirStroke
): void {
  const pts = stroke.points;
  const n = pts.length;
  if (n === 0) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = stroke.color;
  ctx.shadowBlur = 6;

  if (n === 1) {
    // Single tap → a dot.
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  if (n === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    let i;
    for (i = 1; i < n - 2; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    // Final segment: curve through the last two samples.
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }

  ctx.stroke();
  ctx.restore();
}
