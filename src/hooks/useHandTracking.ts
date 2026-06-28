/**
 * useHandTracking.ts  (full rewrite)
 *
 * Runs MediaPipe Hands on a live video element.
 * - Detects up to 2 hands simultaneously
 * - Returns 21 normalized landmarks + world landmarks per hand
 * - Tracks FPS
 * - Exposes ready/error states
 *
 * NO gesture detection here — pure landmark data.
 * NO drawing here — see useHandOverlay.ts.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
// @mediapipe/hands populates window.Hands at runtime via its self-executing bundle.
// We import the package so Vite includes it in the bundle, but access it via window.
import '@mediapipe/hands';

// ─── Inline result types (CJS mediapipe package has no named TS exports) ─────
type MPResults = {
  multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  multiHandWorldLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  multiHandedness?: Array<{ label: string; score: number }>;
};


// ─── Public Types ────────────────────────────────────────────────────────────

/** A single 3-D point. Normalized x/y are 0–1 (image space). z is depth. */
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

/** All data MediaPipe returns for one detected hand. */
export interface DetectedHand {
  /** 0-based index among detected hands (up to maxNumHands - 1) */
  index: number;
  /** 'Left' or 'Right' as labelled by MediaPipe (mirrored for front-facing cam) */
  handedness: 'Left' | 'Right';
  /** Model confidence score 0–1 */
  confidence: number;
  /**
   * 21 normalized landmarks (x, y ∈ [0, 1], z is relative depth).
   * Index mapping: https://developers.google.com/mediapipe/solutions/vision/hand_landmarker
   *   0  = WRIST
   *   1–4  = THUMB (CMC → TIP)
   *   5–8  = INDEX (MCP → TIP)
   *   9–12 = MIDDLE (MCP → TIP)
   *  13–16 = RING (MCP → TIP)
   *  17–20 = PINKY (MCP → TIP)
   */
  landmarks: HandLandmark[];
  /**
   * 21 world landmarks in real-world units (meters).
   * Origin is the hand's geometric center.
   */
  worldLandmarks: HandLandmark[];
}

export interface HandTrackingOptions {
  /** Max simultaneous hands (1 or 2). Default: 2 */
  maxNumHands?: 1 | 2;
  /** Model complexity 0 (lite) or 1 (full). Default: 1 */
  modelComplexity?: 0 | 1;
  /** Detection confidence threshold 0–1. Default: 0.7 */
  minDetectionConfidence?: number;
  /** Tracking confidence threshold 0–1. Default: 0.5 */
  minTrackingConfidence?: number;
}

export interface HandTrackingState {
  /** True once MediaPipe model is initialised */
  isReady: boolean;
  /** True while model is loading */
  isLoading: boolean;
  /** Non-null if initialisation failed */
  error: string | null;
  /** Currently detected hands — empty array when none visible */
  hands: DetectedHand[];
  /** Frames processed per second (rolling 1-s window) */
  fps: number;
  /** Call once the video element is playing to start detection */
  startDetection: () => void;
  /** Stop the detection loop */
  stopDetection: () => void;
}

// ─── Landmark index constants ─────────────────────────────────────────────────

export const LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: HandTrackingOptions = {}
): HandTrackingState {
  const {
    maxNumHands = 2,
    modelComplexity = 1,
    minDetectionConfidence = 0.7,
    minTrackingConfidence = 0.5,
  } = options;

  const [isReady, setIsReady]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [hands, setHands]         = useState<DetectedHand[]>([]);
  const [fps, setFps]             = useState(0);

  const handsRef   = useRef<any>(null);
  const rafRef     = useRef<number | null>(null);
  const fpsWindow  = useRef<number[]>([]);
  const runningRef = useRef(false);

  // ── Initialise MediaPipe Hands ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const init = async () => {
      try {
        // Access Hands via window global (mediapipe bundle is a self-executing IIFE)
        const HandsClass = (window as any).Hands;
        if (!HandsClass) throw new Error('MediaPipe Hands not loaded. Check network access to CDN.');

        const mp = new HandsClass({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        mp.setOptions({
          maxNumHands,
          modelComplexity,
          minDetectionConfidence,
          minTrackingConfidence,
          selfieMode: true,          // mirror for front-facing camera
        });

        mp.onResults(handleResults);

        // Warm up the model
        await mp.initialize();

        if (!cancelled) {
          handsRef.current = mp;
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load MediaPipe Hands model.');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      handsRef.current?.close();
      handsRef.current = null;
    };
    // Re-init only when core options change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxNumHands, modelComplexity, minDetectionConfidence, minTrackingConfidence]);

  // ── Results handler ────────────────────────────────────────────────────────
  const handleResults = useCallback((results: MPResults) => {
    // FPS — rolling 1-second window
    const now = performance.now();
    fpsWindow.current.push(now);
    fpsWindow.current = fpsWindow.current.filter((t) => now - t < 1000);
    setFps(fpsWindow.current.length);

    const detected: DetectedHand[] = [];

    if (
      results.multiHandLandmarks &&
      results.multiHandLandmarks.length > 0
    ) {
      results.multiHandLandmarks.forEach((landmarkList: Array<{x:number;y:number;z:number}>, i: number) => {
        const label = results.multiHandedness?.[i];
        detected.push({
          index: i,
          handedness: (label?.label ?? 'Right') as 'Left' | 'Right',
          confidence: label?.score ?? 1,
          landmarks: landmarkList.map((l) => ({ x: l.x, y: l.y, z: l.z ?? 0 })),
          worldLandmarks:
            results.multiHandWorldLandmarks?.[i]?.map((l) => ({
              x: l.x,
              y: l.y,
              z: l.z ?? 0,
            })) ?? [],
        });
      });
    }

    setHands(detected);
  }, []);

  // ── Detection loop ─────────────────────────────────────────────────────────
  const detect = useCallback(async () => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    if (handsRef.current && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        await handsRef.current.send({ image: video });
      } catch {
        // Suppress frame-level errors (e.g. video paused mid-frame)
      }
    }
    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  const startDetection = useCallback(() => {
    if (runningRef.current || !isReady) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(detect);
  }, [isReady, detect]);

  const stopDetection = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHands([]);
    setFps(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { isReady, isLoading, error, hands, fps, startDetection, stopDetection };
}
