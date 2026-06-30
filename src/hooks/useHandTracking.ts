/**
 * useHandTracking.ts
 *
 * Runs MediaPipe Hands on a live video element.
 * - Detects up to 2 hands simultaneously
 * - Returns 21 normalized landmarks + world landmarks per hand
 * - Tracks FPS
 * - Exposes ready/error states
 * - Classifies gestures: pointing / eraser / fist / two-fingers / pinch / none
 *
 * NO drawing here — see useHandOverlay.ts.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Script loader ─────────────────────────────────────────────────────────
// MediaPipe Hands is an Emscripten bundle that MUST be loaded via a plain
// <script> tag — bundling it with Vite/Rollup corrupts the Emscripten
// Module.arguments global ("n is not a function" at runtime).
//
// The files are served from the SAME version installed in node_modules (see the
// mediapipe-local-assets plugin in vite.config.js), served under /mediapipe/.
// Serving the glue (hands.js) and its WASM/data binaries from one matched source
// avoids the version-mismatch crash you get when they come from different places.
const MEDIAPIPE_BASE = '/mediapipe';

/** Inject a <script> tag and resolve when loaded. No-op if already present. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

/** Load MediaPipe Hands from CDN and wait until window.Hands is populated. */
async function loadMediaPipe(): Promise<void> {
  if ((window as any).Hands) return; // already loaded
  await loadScript(`${MEDIAPIPE_BASE}/hands.js`);
  // Poll briefly for window.Hands — the IIFE runs synchronously after script load
  await new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if ((window as any).Hands) { resolve(); return; }
      if (++attempts > 50) { reject(new Error('window.Hands not found after CDN load')); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

// ─── Shared singleton instance ───────────────────────────────────────────────
// MediaPipe Hands registers its Emscripten runtime as GLOBAL factories on
// `window` (window.createMediapipeSolutionsWasm/...). Creating two `Hands`
// instances therefore runs two Emscripten modules against the SAME global
// runtime, which corrupts it and aborts with:
//   "Module.arguments has been replaced with plain arguments…"
//
// React.StrictMode (dev) double-invokes effects (mount → unmount → mount), so a
// naive per-hook instance is constructed twice in rapid succession and triggers
// exactly that crash — the symptom is a live camera but 0 FPS / no hands, because
// the abort is thrown inside every send() and swallowed by the detection loop.
//
// To stay correct we keep ONE process-wide instance, created once and reused
// across remounts. We only rebuild it when the model options actually change.
let sharedHands: any = null;
let sharedHandsPromise: Promise<any> | null = null;
let sharedHandsKey = '';

interface AcquireOptions {
  maxNumHands: number;
  modelComplexity: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

/** Get the shared MediaPipe Hands instance, (re)creating it only if options change. */
async function acquireHands(opts: AcquireOptions): Promise<any> {
  const key = JSON.stringify(opts);

  // Reuse the live instance or the in-flight creation for the same options.
  if (sharedHandsKey === key) {
    if (sharedHands) return sharedHands;
    if (sharedHandsPromise) return sharedHandsPromise;
  }

  sharedHandsKey = key;
  sharedHandsPromise = (async () => {
    await loadMediaPipe();
    const HandsClass = (window as any).Hands;
    if (!HandsClass) throw new Error('MediaPipe Hands not available after load.');

    // Tear down a prior instance only when options changed.
    if (sharedHands) {
      try { sharedHands.close(); } catch { /* ignore */ }
      sharedHands = null;
    }

    const mp = new HandsClass({
      // Resolve every asset (.wasm/.data/.tflite/...) from the SAME local,
      // version-matched source as hands.js to prevent the Emscripten crash.
      locateFile: (file: string) => `${MEDIAPIPE_BASE}/${file}`,
    });

    mp.setOptions({
      maxNumHands: opts.maxNumHands,
      modelComplexity: opts.modelComplexity,
      minDetectionConfidence: opts.minDetectionConfidence,
      minTrackingConfidence: opts.minTrackingConfidence,
      selfieMode: true,          // mirror for front-facing camera
    });

    await mp.initialize();       // warm up the model
    sharedHands = mp;
    return mp;
  })();

  return sharedHandsPromise;
}

// ─── Inline result types (CJS mediapipe package has no named TS exports) ─────
type MPResults = {
  multiHandLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  multiHandWorldLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
  multiHandedness?: Array<{ label: string; score: number }>;
};

// ─── Gesture Types ────────────────────────────────────────────────────────────

/**
 * Recognised gesture names.
 *   pointing   — index finger extended only   → draw (pencil)
 *   eraser     — all 5 fingers open           → erase
 *   fist       — all fingers closed           → pan
 *   two-fingers — index + middle up            → select
 *   pinch      — thumb + index close together → drag selected
 *   none       — no hand / unrecognised
 */
export type GestureType =
  | 'None'
  | 'Index Finger'
  | 'Open Palm'
  | 'Closed Fist'
  | 'Peace Sign'
  | 'Three Fingers'
  | 'Pinch';

// ─── Gesture classification ───────────────────────────────────────────────────

/**
 * Returns true if a finger tip is raised above its PIP joint
 * (landmark indices: tip = base+3, pip = base+1 in the 5-point finger chain).
 * Works for index, middle, ring, pinky. Not used for thumb.
 */
function isFingerUp(
  lms: { x: number; y: number; z: number }[],
  tipIdx: number,
  pipIdx: number
): boolean {
  return lms[tipIdx].y < lms[pipIdx].y;
}

/**
 * Classifies the dominant hand gesture from 21 normalized landmarks.
 */
function classifyGesture(
  lms: { x: number; y: number; z: number }[]
): GestureType {
  if (!lms || lms.length < 21) return 'none';

  const indexUp  = isFingerUp(lms, 8,  6);
  const middleUp = isFingerUp(lms, 12, 10);
  const ringUp   = isFingerUp(lms, 16, 14);
  const pinkyUp  = isFingerUp(lms, 20, 18);

  // Thumb: compare tip x to IP joint x (works for mirrored / selfie mode)
  const thumbUp =
    Math.abs(lms[4].x - lms[3].x) > 0.04 ||
    Math.abs(lms[4].x - lms[2].x) > 0.08;

  // Pinch: thumb tip close to index tip
  const dx = lms[4].x - lms[8].x;
  const dy = lms[4].y - lms[8].y;
  const pinchDist = Math.sqrt(dx * dx + dy * dy);
  if (pinchDist < 0.07) return 'Pinch';

  // All fingers up → eraser
  if (indexUp && middleUp && ringUp && pinkyUp) return 'Open Palm';

  // No fingers up → fist
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) return 'Closed Fist';

  // Index + middle + ring up → Three Fingers
  if (indexUp && middleUp && ringUp && !pinkyUp) return 'Three Fingers';

  // Index + middle up only → two-fingers (select)
  if (indexUp && middleUp && !ringUp && !pinkyUp) return 'Peace Sign';

  // Index only → pointing (draw)
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'Index Finger';

  return 'None';
}


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
  /** Gesture classified from the first detected hand */
  currentGesture: GestureType;
  /** 21 landmarks of the first detected hand (null when no hand visible) */
  landmarks: HandLandmark[] | null;
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

  const [isReady, setIsReady]         = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [hands, setHands]             = useState<DetectedHand[]>([]);
  const [fps, setFps]                 = useState(0);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('None');
  const [landmarks, setLandmarks]     = useState<HandLandmark[] | null>(null);

  const handsRef   = useRef<any>(null);
  const rafRef     = useRef<number | null>(null);
  const fpsWindow  = useRef<number[]>([]);
  const runningRef = useRef(false);

  // ── Initialise MediaPipe Hands ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    acquireHands({ maxNumHands, modelComplexity, minDetectionConfidence, minTrackingConfidence })
      .then((mp) => {
        if (cancelled) return;
        handsRef.current = mp;
        // Bind THIS hook instance's results handler (last mount wins — safe under
        // StrictMode since the underlying instance is shared, not duplicated).
        mp.onResults(handleResults);
        setIsReady(true);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load MediaPipe Hands model.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      // Do NOT close the shared instance here — StrictMode remounts (and HMR)
      // reuse it. Just stop this hook's detection loop.
      runningRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // Re-acquire only when core options change. handleResults is stable.
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

    // Classify gesture from the first detected hand
    if (detected.length > 0) {
      setCurrentGesture(classifyGesture(detected[0].landmarks));
      setLandmarks(detected[0].landmarks);
    } else {
      setCurrentGesture('None');
      setLandmarks(null);
    }
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
    setCurrentGesture('None');
    setLandmarks(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    isReady,
    isLoading,
    error,
    hands,
    fps,
    currentGesture,
    landmarks,
    startDetection,
    stopDetection,
  };
}
