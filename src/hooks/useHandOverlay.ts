/**
 * useHandOverlay.ts
 *
 * Renders 21 landmarks + hand skeleton onto a <canvas> element
 * that sits on top of a <video> feed.
 *
 * Tracks the index fingertip, applies moving average smoothing,
 * draws a green circle, and outputs coordinate labels.
 *
 * Colour palette:
 *   Right hand → violet (#a78bfa / #7c3aed)
 *   Left  hand → cyan   (#67e8f9 / #0891b2)
 */

import { useEffect, useRef } from 'react';
import type { DetectedHand, HandLandmark } from './useHandTracking';

// ─── MediaPipe Hand Connections ───────────────────────────────────────────────
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [5, 9], [9, 13], [13, 17],
];

// Per-finger base colours
const FINGER_COLORS = [
  '#94a3b8', // wrist (0)
  '#f59e0b', '#f59e0b', '#f59e0b', '#f59e0b', // thumb (1-4)
  '#22c55e', '#22c55e', '#22c55e', '#22c55e', // index (5-8)
  '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', // middle (9-12)
  '#f97316', '#f97316', '#f97316', '#f97316', // ring (13-16)
  '#ec4899', '#ec4899', '#ec4899', '#ec4899', // pinky (17-20)
];

interface OverlayStyle {
  landmarkRadius?: number;
  skeletonWidth?: number;
  skeletonAlpha?: number;
  landmarkAlpha?: number;
}

export function useHandOverlay(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  hands: DetectedHand[],
  style: OverlayStyle = {},
  onFingertipChange?: (coords: { x: number; y: number } | null) => void
) {
  const {
    landmarkRadius = 5,
    skeletonWidth  = 2.5,
    skeletonAlpha  = 0.85,
    landmarkAlpha  = 1,
  } = style;

  // History buffer for fingertip coordinates moving average filtering
  const fingertipHistoryRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cw = canvas.width;
    const ch = canvas.height;

    // Convert normalized landmark to canvas pixel coords
    const toPixel = (lm: HandLandmark) => ({
      px: lm.x * cw,
      py: lm.y * ch,
    });

    // 1. Draw connections and joints for all hands
    for (const hand of hands) {
      const isRight = hand.handedness === 'Right';
      const skeletonColor = isRight
        ? `rgba(167, 139, 250, ${skeletonAlpha})`
        : `rgba(103, 232, 249, ${skeletonAlpha})`;

      // Draw Skeleton
      ctx.save();
      ctx.strokeStyle = skeletonColor;
      ctx.lineWidth   = skeletonWidth;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      for (const [a, b] of HAND_CONNECTIONS) {
        const from = toPixel(hand.landmarks[a]);
        const to   = toPixel(hand.landmarks[b]);
        ctx.beginPath();
        ctx.moveTo(from.px, from.py);
        ctx.lineTo(to.px, to.py);
        ctx.stroke();
      }
      ctx.restore();

      // Draw Landmark Dots
      hand.landmarks.forEach((lm, i) => {
        const { px, py } = toPixel(lm);
        const baseColor  = FINGER_COLORS[i] ?? '#94a3b8';

        ctx.save();
        ctx.globalAlpha = landmarkAlpha;

        // Outer ring
        ctx.beginPath();
        ctx.arc(px, py, landmarkRadius + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isRight
          ? 'rgba(124, 58, 237, 0.5)'
          : 'rgba(8, 145, 178, 0.5)';
        ctx.fill();

        // Inner dot
        ctx.beginPath();
        ctx.arc(px, py, landmarkRadius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        // Tip highlights
        if ([4, 8, 12, 16, 20].includes(i)) {
          ctx.beginPath();
          ctx.arc(px, py, landmarkRadius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        ctx.restore();
      });

      // Handedness label near the wrist
      const wrist = toPixel(hand.landmarks[0]);
      ctx.save();
      ctx.font         = 'bold 13px Inter, sans-serif';
      ctx.fillStyle    = isRight ? '#a78bfa' : '#67e8f9';
      ctx.shadowColor  = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur   = 4;
      ctx.textAlign    = 'center';
      ctx.fillText(
        `${hand.handedness} (${(hand.confidence * 100).toFixed(0)}%)`,
        wrist.px,
        wrist.py + 22
      );
      ctx.restore();
    }

    // 2. Track, Smooth, and Highlight the Index Fingertip
    const firstHand = hands[0];
    if (firstHand && firstHand.landmarks[8]) {
      const indexTip = firstHand.landmarks[8];
      const { px, py } = toPixel(indexTip);

      // Moving average smoothing window
      const history = fingertipHistoryRef.current;
      history.push({ x: px, y: py });

      const WINDOW_SIZE = 8;
      if (history.length > WINDOW_SIZE) {
        history.shift();
      }

      // Compute smoothed position
      const sum = history.reduce((acc, curr) => ({ x: acc.x + curr.x, y: acc.y + curr.y }), { x: 0, y: 0 });
      const smoothedX = sum.x / history.length;
      const smoothedY = sum.y / history.length;

      // Draw neon green circle on index fingertip
      ctx.save();
      ctx.beginPath();
      ctx.arc(smoothedX, smoothedY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e'; // Green
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Render coordinates text (X, Y) next to the green circle
      ctx.save();
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;

      const labelText = `X: ${Math.round(smoothedX)}, Y: ${Math.round(smoothedY)}`;

      // Un-mirror the text drawing context
      ctx.translate(smoothedX, smoothedY);
      ctx.scale(-1, 1);
      ctx.fillText(labelText, 14, -12);
      ctx.restore();

      // Bubble coordinates back to React
      onFingertipChange?.({ x: smoothedX, y: smoothedY });
    } else {
      fingertipHistoryRef.current = [];
      onFingertipChange?.(null);
    }
  }, [hands, canvasRef, landmarkRadius, skeletonWidth, skeletonAlpha, landmarkAlpha, onFingertipChange]);
}
