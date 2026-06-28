import React, { forwardRef, useImperativeHandle } from 'react';
import { Camera, CameraOff, AlertTriangle, Loader2, Download } from 'lucide-react';
import { useWebcam } from '../hooks/useWebcam';
import type { WebcamOptions } from '../hooks/useWebcam';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WebcamViewHandle {
  /** Start the webcam stream. */
  start: () => Promise<void>;
  /** Stop the webcam stream and release the device. */
  stop: () => void;
  /** Return a PNG data-URL of the current (mirrored) frame, or null if inactive. */
  captureSnapshot: () => string | null;
  /** The underlying <video> element, e.g. to pipe into MediaPipe. */
  videoElement: HTMLVideoElement | null;
  /** The offscreen <canvas> element with already-mirrored pixels. */
  canvasElement: HTMLCanvasElement | null;
}

export interface WebcamViewProps extends WebcamOptions {
  /** Show/hide the control buttons overlay (default: true). */
  showControls?: boolean;
  /** Show/hide the FPS badge (default: true). */
  showFps?: boolean;
  /** Show/hide a resolution badge (default: false). */
  showResolution?: boolean;
  /** Extra Tailwind classes applied to the outermost wrapper. */
  className?: string;
  /** Label shown on the start button (default: 'Start Camera'). */
  startLabel?: string;
  /** Label shown on the stop button (default: 'Stop Camera'). */
  stopLabel?: string;
  /** Callback fired when the stream becomes active. */
  onStart?: () => void;
  /** Callback fired when the stream is stopped. */
  onStop?: () => void;
  /** Callback fired when an error occurs. */
  onError?: (err: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WebcamView = forwardRef<WebcamViewHandle, WebcamViewProps>(
  (
    {
      width = 640,
      height = 480,
      facingMode = 'user',
      onFrame,
      showControls = true,
      showFps = true,
      showResolution = false,
      className = '',
      startLabel = 'Start Camera',
      stopLabel = 'Stop Camera',
      onStart,
      onStop,
      onError,
    },
    ref
  ) => {
    const { videoRef, canvasRef, state, start, stop, captureSnapshot } = useWebcam({
      width,
      height,
      facingMode,
      onFrame,
    });

    // Propagate state changes to optional callbacks
    const prevActiveRef = React.useRef(false);
    React.useEffect(() => {
      if (state.isActive && !prevActiveRef.current) onStart?.();
      if (!state.isActive && prevActiveRef.current) onStop?.();
      prevActiveRef.current = state.isActive;
    }, [state.isActive, onStart, onStop]);

    React.useEffect(() => {
      if (state.error) onError?.(state.error);
    }, [state.error, onError]);

    // Expose imperative API via ref
    useImperativeHandle(ref, () => ({
      start,
      stop,
      captureSnapshot,
      get videoElement() { return videoRef.current; },
      get canvasElement() { return canvasRef.current; },
    }), [start, stop, captureSnapshot, videoRef, canvasRef]);

    // ── Snapshot download helper ────────────────────────────────────────────
    const handleDownloadSnapshot = () => {
      const dataUrl = captureSnapshot();
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `webcam-snapshot-${Date.now()}.png`;
      a.click();
    };

    // ── FPS colour ─────────────────────────────────────────────────────────
    const fpsColor =
      state.fps >= 24
        ? 'bg-emerald-500/90 text-white'
        : state.fps >= 12
        ? 'bg-amber-500/90 text-white'
        : 'bg-rose-500/90 text-white';

    return (
      <div
        className={`relative flex flex-col rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl ${className}`}
      >
        {/* ── Video feed ──────────────────────────────────────────────── */}
        <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
          {/* Actual <video> element – CSS mirror applied so the UI feels natural */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              state.isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ transform: 'scaleX(-1)' }}
            muted
            playsInline
            aria-label="Webcam feed"
          />

          {/* Offscreen canvas used by frame loop – invisible to user */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          {/* ── Placeholder shown when camera is off ──────────────────── */}
          {!state.isActive && !state.isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950">
              <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                <Camera className="h-8 w-8 text-slate-600" />
              </div>
              {state.error ? (
                <div className="flex flex-col items-center gap-1.5 px-6 text-center">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                  <p className="text-xs text-rose-400 font-semibold max-w-[240px] leading-snug">
                    {state.error}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-medium">Camera is off</p>
              )}
            </div>
          )}

          {/* ── Loading spinner ───────────────────────────────────────── */}
          {state.isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Requesting camera…</p>
            </div>
          )}

          {/* ── Badges overlay ────────────────────────────────────────── */}
          {state.isActive && (
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none">
              {/* LIVE badge */}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-rose-600/90 text-white shadow">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>

              {/* FPS badge */}
              {showFps && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shadow ${fpsColor}`}
                >
                  {state.fps} FPS
                </span>
              )}

              {/* Resolution badge */}
              {showResolution && state.width > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-700/90 text-slate-200 shadow">
                  {state.width}×{state.height}
                </span>
              )}
            </div>
          )}

          {/* ── Snapshot download button ──────────────────────────────── */}
          {state.isActive && (
            <button
              onClick={handleDownloadSnapshot}
              title="Download snapshot"
              className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shadow cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        {showControls && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  state.isActive
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-500/60 animate-pulse'
                    : state.isLoading
                    ? 'bg-amber-400 animate-pulse'
                    : state.error
                    ? 'bg-rose-400'
                    : 'bg-slate-600'
                }`}
              />
              <span className="text-[11px] font-semibold text-slate-400 select-none">
                {state.isActive
                  ? 'Camera Active'
                  : state.isLoading
                  ? 'Connecting…'
                  : state.error
                  ? 'Error'
                  : 'Camera Off'}
              </span>
            </div>

            <button
              onClick={state.isActive ? stop : start}
              disabled={state.isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                state.isActive
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow hover:shadow-blue-500/25'
              }`}
            >
              {state.isActive ? (
                <>
                  <CameraOff className="h-3.5 w-3.5" />
                  {stopLabel}
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" />
                  {startLabel}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }
);

WebcamView.displayName = 'WebcamView';
