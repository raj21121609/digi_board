/**
 * HandOverlay.tsx
 *
 * Composites a webcam <video> with a transparent <canvas> overlay
 * that shows MediaPipe hand landmarks + skeleton in real-time.
 *
 * Props:
 *   width / height   — display dimensions (default 640×480)
 *   showLandmarks    — toggle landmark dots (default true)
 *   showSkeleton     — toggle skeleton lines (default true)
 *   onHandsChange    — optional callback fired each time hand data updates
 *   options          — forwarded to useHandTracking
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { useWebcam }         from '../hooks/useWebcam';
import { useHandTracking }   from '../hooks/useHandTracking';
import { useHandOverlay }    from '../hooks/useHandOverlay';
import { useAirDrawing }     from '../hooks/useAirDrawing';
import type { DetectedHand, HandTrackingOptions } from '../hooks/useHandTracking';

// Air-drawing pen colours.
const PEN_COLORS = ['#22d3ee', '#f43f5e', '#a3e635', '#fbbf24', '#ffffff'];

export interface HandOverlayProps {
  width?:           number;
  height?:          number;
  showLandmarks?:   boolean;
  showSkeleton?:    boolean;
  onHandsChange?:   (hands: DetectedHand[]) => void;
  options?:         HandTrackingOptions;
  className?:       string;
}

export default function HandOverlay({
  width          = 640,
  height         = 480,
  showLandmarks  = true,
  showSkeleton   = true,
  onHandsChange,
  options        = {},
  className      = '',
}: HandOverlayProps) {
  const [fingertip, setFingertip] = useState<{ x: number; y: number } | null>(null);

  // Dedicated canvas for the landmark/skeleton overlay. This MUST be separate
  // from useWebcam's `canvasRef`: useWebcam uses its canvas as an internal mirror
  // buffer, repainting the video frame (and resetting width/height, which clears
  // the canvas) on every animation frame — which would erase the overlay ~60×/s.
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dedicated, persistent canvas for air-drawn strokes (separate from the
  // per-frame landmark overlay, which clears itself every frame).
  const airCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);

  // ── Webcam stream ──────────────────────────────────────────────────────────
  // `canvasRef` here is useWebcam's offscreen processing buffer — intentionally
  // left unmounted/unused; the overlay draws onto `overlayCanvasRef` instead.
  const {
    videoRef,
    state: webcamState,
    start: startWebcam,
    stop: stopWebcam
  } = useWebcam({ width, height });

  // ── MediaPipe tracking ─────────────────────────────────────────────────────
  const tracking = useHandTracking(videoRef, {
    maxNumHands: 2,
    ...options,
  });

  // Start detection once camera is active and model is ready
  useEffect(() => {
    if (webcamState.isActive && tracking.isReady) {
      tracking.startDetection();
    }
    return () => {
      tracking.stopDetection();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcamState.isActive, tracking.isReady]);

  // Sync overlay + air-drawing canvas sizes to the configured dimensions
  useEffect(() => {
    for (const ref of [overlayCanvasRef, airCanvasRef]) {
      const canvas = ref.current;
      if (canvas) {
        canvas.width  = width;
        canvas.height = height;
      }
    }
  }, [width, height]);

  // Fire onHandsChange callback
  useEffect(() => {
    onHandsChange?.(tracking.hands);
  }, [tracking.hands, onHandsChange]);

  // ── Overlay rendering (no-op if toggles are off) ──────────────────────────
  useHandOverlay(
    overlayCanvasRef,
    showLandmarks || showSkeleton ? tracking.hands : [],
    {
      landmarkRadius: showLandmarks ? 5 : 0,
      skeletonWidth:  showSkeleton  ? 2.5 : 0,
    },
    setFingertip
  );

  // ── Air drawing ────────────────────────────────────────────────────────────
  // Draw only when the "pointing" gesture is active (index finger raised alone),
  // following the smoothed fingertip. Lowering the finger ends the stroke.
  const air = useAirDrawing(
    airCanvasRef,
    tracking.currentGesture === 'pointing',
    fingertip,
    { color: penColor, width: 4 }
  );

  // ── Start / Stop handler ───────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (webcamState.isActive) {
      tracking.stopDetection();
      stopWebcam();
    } else {
      startWebcam();
    }
  }, [webcamState.isActive, tracking, startWebcam, stopWebcam]);

  const [showDebug, setShowDebug] = useState(false);

  return (
    <div
      className={`hand-overlay-root ${className}`}
      style={{ width, position: 'relative', userSelect: 'none' }}
    >
      {/* ── Video + Canvas stack ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width,
          height,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0a0b0e',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.7)',
        }}
      >
        {/* Webcam feed */}
        <video
          ref={videoRef}
          id="hand-overlay-video"
          width={width}
          height={height}
          muted
          playsInline
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // mirror for selfie mode
          }}
        />

        {/* Air-drawn strokes (persistent; sits below the landmark overlay) */}
        <canvas
          ref={airCanvasRef}
          id="hand-overlay-air-canvas"
          width={width}
          height={height}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Landmark overlay */}
        <canvas
          ref={overlayCanvasRef}
          id="hand-overlay-canvas"
          width={width}
          height={height}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Fingertip coordinates overlay card */}
        {fingertip && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: 16,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#22c55e',
            fontSize: 12,
            fontFamily: 'monospace',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ☝ Index Fingertip
            </div>
            <div>X: <span style={{ color: '#ffffff' }}>{fingertip.x.toFixed(1)}px</span></div>
            <div>Y: <span style={{ color: '#ffffff' }}>{fingertip.y.toFixed(1)}px</span></div>
          </div>
        )}

        {/* Loading state */}
        {tracking.isLoading && (
          <div className="ho-overlay-msg">
            <span className="ho-spinner" />
            Loading hand model…
          </div>
        )}

        {/* Not started state */}
        {!webcamState.isActive && !webcamState.isLoading && !tracking.isLoading && (
          <div className="ho-overlay-msg ho-start-prompt">
            <span style={{ fontSize: 40 }}>✋</span>
            <span>Camera not started</span>
          </div>
        )}

        {/* Status chips */}
        <div className="ho-chips">
          {webcamState.isActive && (
            <span className={`ho-chip ${tracking.hands.length > 0 ? 'ho-chip-active' : ''}`}>
              {tracking.hands.length === 0
                ? 'No hands'
                : tracking.hands.length === 1
                ? '1 hand'
                : '2 hands'}
            </span>
          )}
          {webcamState.isActive && (
            <span className="ho-chip ho-chip-fps">{tracking.fps} FPS</span>
          )}
          {webcamState.isActive && air.isDrawing && (
            <span
              className="ho-chip ho-chip-active"
              style={{ background: penColor, color: '#0a0b0e', fontWeight: 700 }}
            >
              ✏ Drawing
            </span>
          )}
        </div>
      </div>

      {/* ── Air-drawing controls ─────────────────────────────────────────── */}
      <div
        className="ho-controls"
        style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ✏ Air Pen
        </span>

        {/* Colour swatches */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Pen colour ${c}`}
              onClick={() => setPenColor(c)}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: c,
                cursor: 'pointer',
                border: penColor === c ? '2px solid #ffffff' : '2px solid transparent',
                boxShadow: penColor === c ? `0 0 0 2px ${c}` : 'none',
              }}
            />
          ))}
        </div>

        <button
          id="ho-btn-air-undo"
          className="ho-btn ho-btn-ghost"
          onClick={air.undo}
          disabled={air.strokeCount === 0}
        >
          ↶ Undo
        </button>
        <button
          id="ho-btn-air-clear"
          className="ho-btn ho-btn-ghost"
          onClick={air.clear}
          disabled={air.strokeCount === 0 && !air.isDrawing}
        >
          🗑 Clear
        </button>

        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
          {air.strokeCount} stroke{air.strokeCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="ho-controls">
        <button
          id="ho-btn-toggle-camera"
          className={`ho-btn ${webcamState.isActive ? 'ho-btn-stop' : 'ho-btn-start'}`}
          onClick={handleToggle}
          disabled={webcamState.isLoading || tracking.isLoading}
        >
          {webcamState.isLoading
            ? '⏳ Starting…'
            : webcamState.isActive
            ? '⏹ Stop Camera'
            : '▶ Start Camera'}
        </button>

        <button
          id="ho-btn-debug"
          className="ho-btn ho-btn-ghost"
          onClick={() => setShowDebug((v) => !v)}
        >
          {showDebug ? 'Hide' : 'Show'} Data
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {(webcamState.error || tracking.error) && (
        <div className="ho-error">
          ⚠ {webcamState.error ?? tracking.error}
        </div>
      )}

      {/* ── Debug landmark table ──────────────────────────────────────────── */}
      {showDebug && tracking.hands.length > 0 && (
        <div className="ho-debug">
          {tracking.hands.map((hand) => (
            <div key={hand.index} className="ho-debug-hand">
              <div className="ho-debug-title">
                {hand.handedness} hand &nbsp;
                <span className="ho-debug-conf">
                  {(hand.confidence * 100).toFixed(1)}% confidence
                </span>
              </div>
              <div className="ho-debug-grid">
                {hand.landmarks.map((lm, i) => (
                  <div key={i} className="ho-debug-lm">
                    <span className="ho-debug-idx">#{i}</span>
                    <span>{lm.x.toFixed(3)}</span>
                    <span>{lm.y.toFixed(3)}</span>
                    <span className="ho-debug-z">{lm.z.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
