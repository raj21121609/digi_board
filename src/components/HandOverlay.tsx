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
import type { DetectedHand, HandTrackingOptions } from '../hooks/useHandTracking';

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

  // ── Webcam stream ──────────────────────────────────────────────────────────
  const {
    videoRef,
    canvasRef,
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

  // Sync canvas size to video
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width  = width;
      canvas.height = height;
    }
  }, [width, height, canvasRef]);

  // Fire onHandsChange callback
  useEffect(() => {
    onHandsChange?.(tracking.hands);
  }, [tracking.hands, onHandsChange]);

  // ── Overlay rendering (no-op if toggles are off) ──────────────────────────
  useHandOverlay(
    canvasRef,
    showLandmarks || showSkeleton ? tracking.hands : [],
    {
      landmarkRadius: showLandmarks ? 5 : 0,
      skeletonWidth:  showSkeleton  ? 2.5 : 0,
    },
    setFingertip
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

        {/* Landmark overlay */}
        <canvas
          ref={canvasRef}
          id="hand-overlay-canvas"
          width={width}
          height={height}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            transform: 'scaleX(-1)', // mirror to match video
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
        </div>
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
