/**
 * useHandOverlay.ts
 *
 * Renders 21 landmarks + hand skeleton onto a <canvas> element
 * that sits on top of a <video> feed.
 *
 * Purely a rendering side-effect — returns nothing.
 * Call it with the latest `hands[]` from useHandTracking on every frame.
 *
 * Colour palette:
 *   Right hand → violet (#a78bfa / #7c3aed)
 *   Left  hand → cyan   (#67e8f9 / #0891b2)
 */

import { useEffect, useRef } from 'react';
import type { DetectedHand, HandLandmark } from './useHandTracking';

// ─── MediaPipe Hand Connections ───────────────────────────────────────────────
// Each tuple is [fromIdx, toIdx] matching the 21-landmark model.
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

// Per-finger base colours (for landmark dots) — index 0 is wrist/palm
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
  style: OverlayStyle = {}
) {
  const {
    landmarkRadius = 5,
    skeletonWidth  = 2.5,
    skeletonAlpha  = 0.85,
    landmarkAlpha  = 1,
  } = style;

  // Keep a ref to latest hands so the draw call always has fresh data
  const handsRef = useRef(hands);
  useEffect(() => { handsRef.current = hands; }, [hands]);

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

    for (const hand of hands) {
      const isRight = hand.handedness === 'Right';

      // Skeleton colour (semi-transparent)
      const skeletonColor = isRight
        ? `rgba(167, 139, 250, ${skeletonAlpha})` // violet
        : `rgba(103, 232, 249, ${skeletonAlpha})`; // cyan

      // ── Skeleton (connections) ──────────────────────────────────────────────
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

      // ── Landmarks (dots) ────────────────────────────────────────────────────
      hand.landmarks.forEach((lm, i) => {
        const { px, py } = toPixel(lm);
        const baseColor  = FINGER_COLORS[i] ?? '#94a3b8';

        ctx.save();
        ctx.globalAlpha = landmarkAlpha;

        // Outer ring (hand-colour tint)
        ctx.beginPath();
        ctx.arc(px, py, landmarkRadius + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isRight
          ? 'rgba(124, 58, 237, 0.5)'
          : 'rgba(8, 145, 178, 0.5)';
        ctx.fill();

        // Inner dot (finger colour)
        ctx.beginPath();
        ctx.arc(px, py, landmarkRadius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        // Tip highlights (landmarks 4,8,12,16,20) — larger bright dot
        if ([4, 8, 12, 16, 20].includes(i)) {
          ctx.beginPath();
          ctx.arc(px, py, landmarkRadius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        ctx.restore();
      });

      // ── Handedness label near the wrist ─────────────────────────────────────
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
  }, [hands, canvasRef, landmarkRadius, skeletonWidth, skeletonAlpha, landmarkAlpha]);
}
