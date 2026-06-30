import React, { useRef, useEffect, useState } from 'react';
import { Eye, Info, Video, Keyboard, Camera, CameraOff } from 'lucide-react';
import type { GestureType, HandLandmark } from '../hooks/useHandTracking';
import { HAND_CONNECTIONS } from '../hooks/useHandOverlay';

// Per-finger joint colours for the 21 landmarks (wrist, thumb, index, middle,
// ring, pinky) — mirrors the MediaPipe convention used in useHandOverlay.
const FINGER_COLORS = [
  '#94a3b8',                                     // wrist (0)
  '#f59e0b', '#f59e0b', '#f59e0b', '#f59e0b',    // thumb  (1-4)
  '#22c55e', '#22c55e', '#22c55e', '#22c55e',    // index  (5-8)
  '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6',    // middle (9-12)
  '#f97316', '#f97316', '#f97316', '#f97316',    // ring   (13-16)
  '#ec4899', '#ec4899', '#ec4899', '#ec4899',    // pinky  (17-20)
];

interface GestureSidebarProps {
  isCameraActive: boolean;
  landmarks: HandLandmark[] | null;
  currentGesture: GestureType;
  /** Direct ref to the shared <video> element owned by useWebcam in App */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggleCamera: () => void;
  fps: number;
  /** True while the MediaPipe hand model is loading */
  modelLoading?: boolean;
  /** Non-null if the MediaPipe hand model failed to initialise */
  modelError?: string | null;
}

const GESTURE_GUIDE = [
  {
    gesture: 'pointing',
    name: 'Index Pointing',
    action: 'Draw (Pencil)',
    desc: 'Extend index finger; draw on canvas.',
    key: '1',
  },
  {
    gesture: 'eraser',
    name: 'Open Hand',
    action: 'Erase (Eraser)',
    desc: 'Keep all fingers open; sweeps drawing.',
    key: '2',
  },
  {
    gesture: 'fist',
    name: 'Closed Fist',
    action: 'Pan Board',
    desc: 'Make a fist; drag to pan canvas.',
    key: '3',
  },
  {
    gesture: 'two-fingers',
    name: 'Index + Middle Up',
    action: 'Select Tool',
    desc: 'Keep index and middle up; choose elements.',
    key: '4',
  },
  {
    gesture: 'pinch',
    name: 'Thumb + Index Pinch',
    action: 'Drag Selected',
    desc: 'Pinch index and thumb to move elements.',
    key: 'Pinch',
  },
];

export const GestureSidebar: React.FC<GestureSidebarProps> = ({
  isCameraActive,
  landmarks,
  currentGesture,
  videoRef,
  onToggleCamera,
  fps,
  modelLoading = false,
  modelError = null,
}) => {
  const landmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Index-fingertip tracking state ──────────────────────────────────────────
  // Moving-average buffer (normalized coords) for jitter-free fingertip tracking,
  // plus the smoothed pixel coordinates we surface in the on-feed readout.
  const fingertipHistory = useRef<{ x: number; y: number }[]>([]);
  const lastDisplayedRef = useRef<{ x: number; y: number } | null>(null);
  const [fingertip, setFingertip] = useState<{ x: number; y: number } | null>(null);

  // Smoothing window + reference resolution for the displayed coordinates
  // (matches the 640×480 capture configured by useWebcam in App).
  const SMOOTH_WINDOW = 8;
  const REF_W = 640;
  const REF_H = 480;

  // NOTE: The <video> below is bound DIRECTLY to the shared `videoRef` owned by
  // useWebcam in App. useWebcam sets srcObject + plays on this exact element,
  // and useHandTracking reads frames from it. Binding it here (instead of a
  // separate display ref) is what lets the camera actually start and feed
  // MediaPipe — without it, videoRef.current stays null and no hands are ever
  // detected.

  // ── Draw hand landmarks overlay ───────────────────────────────────────────
  useEffect(() => {
    const canvas = landmarkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) {
      // No hand → reset the smoothing buffer and clear the readout.
      fingertipHistory.current = [];
      if (lastDisplayedRef.current !== null) {
        lastDisplayedRef.current = null;
        setFingertip(null);
      }
      return;
    }

    // Convert a normalized landmark to canvas pixels. The feed is mirrored for
    // selfie view but this canvas is NOT CSS-flipped, so we un-mirror x (1 - x).
    const toPx = (lm: HandLandmark) => ({
      x: (1 - lm.x) * canvas.width,
      y: lm.y * canvas.height,
    });

    // 1. Skeleton connections — full MediaPipe 21-point connection set.
    ctx.strokeStyle = 'rgba(59,130,246,0.65)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [a, b] of HAND_CONNECTIONS) {
      const p1 = landmarks[a];
      const p2 = landmarks[b];
      if (!p1 || !p2) continue;
      const from = toPx(p1);
      const to = toPx(p2);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    // 2. All 21 landmark joints — per-finger colours, fingertips enlarged.
    landmarks.forEach((lm, idx) => {
      const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
      const { x, y } = toPx(lm);
      const color = FINGER_COLORS[idx] ?? '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, isTip ? 5.5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // ── Index fingertip (landmark 8): smooth → draw green circle → read out ───
    const tip = landmarks[8];
    if (tip) {
      // Moving-average filter in normalized space to kill per-frame jitter.
      const hist = fingertipHistory.current;
      hist.push({ x: tip.x, y: tip.y });
      if (hist.length > SMOOTH_WINDOW) hist.shift();

      const sum = hist.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
      const sx = sum.x / hist.length;
      const sy = sum.y / hist.length;

      // Draw on the mirrored canvas (video is flipped for selfie view, so x → 1 - x).
      const cx = (1 - sx) * canvas.width;
      const cy = sy * canvas.height;

      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Surface smoothed coordinates in 640×480 reference pixels, matching the
      // mirrored on-screen position. Only update state when the rounded value
      // changes to avoid redundant re-renders.
      const dispX = Math.round((1 - sx) * REF_W);
      const dispY = Math.round(sy * REF_H);
      const prev = lastDisplayedRef.current;
      if (!prev || prev.x !== dispX || prev.y !== dispY) {
        lastDisplayedRef.current = { x: dispX, y: dispY };
        setFingertip({ x: dispX, y: dispY });
      }
    } else {
      fingertipHistory.current = [];
      if (lastDisplayedRef.current !== null) {
        lastDisplayedRef.current = null;
        setFingertip(null);
      }
    }
  }, [landmarks]);

  // FPS colour
  const fpsColor =
    fps >= 24 ? 'bg-emerald-500/90 text-white' :
    fps >= 12 ? 'bg-amber-500/90 text-white' :
                'bg-rose-500/90 text-white';

  return (
    <aside className="w-80 h-[calc(100vh-4rem)] bg-slate-900 border-l border-slate-800 flex flex-col z-20 overflow-y-auto">

      {/* ── Camera Feed ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
          <Video className="h-4 w-4 text-blue-400" />
          Camera Feed
        </h3>

        {/* Video + landmark overlay stack */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl">
          <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
            {/* Live video element — mirrors the stream from App's useWebcam */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{ transform: 'scaleX(-1)' }}
              muted
              playsInline
              aria-label="Webcam feed"
            />

            {/* Placeholder when camera is off */}
            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950">
                <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                  <Camera className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Camera is off</p>
              </div>
            )}

            {/* Live badge */}
            {isCameraActive && (
              <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-rose-600/90 text-white shadow">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shadow ${fpsColor}`}>
                  {fps} FPS
                </span>
              </div>
            )}

            {/* Landmark skeleton overlay */}
            <canvas
              ref={landmarkCanvasRef}
              width={320}
              height={240}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Index fingertip coordinate readout */}
            {isCameraActive && fingertip && (
              <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex flex-col gap-0.5 rounded-lg border border-emerald-500/40 bg-slate-950/85 px-2.5 py-1.5 font-mono shadow-lg backdrop-blur-sm">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  ☝ Index Fingertip
                </span>
                <span className="text-[11px] text-emerald-400">
                  X: <span className="text-white">{fingertip.x}</span> px
                </span>
                <span className="text-[11px] text-emerald-400">
                  Y: <span className="text-white">{fingertip.y}</span> px
                </span>
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                isCameraActive
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-500/60 animate-pulse'
                  : 'bg-slate-600'
              }`} />
              <span className="text-[11px] font-semibold text-slate-400 select-none">
                {isCameraActive ? 'Camera Active' : 'Camera Off'}
              </span>
            </div>

            <button
              onClick={onToggleCamera}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                isCameraActive
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow hover:shadow-blue-500/25'
              }`}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="h-3.5 w-3.5" />
                  Stop Hand Track
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" />
                  Start Hand Track
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI model status / errors */}
        {modelLoading && (
          <div className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Loading hand model…
          </div>
        )}
        {modelError && (
          <div className="text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-2.5 py-1.5 leading-snug">
            ⚠ Hand model failed to load: {modelError}
          </div>
        )}
      </div>

      {/* ── Live Gesture Status ───────────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-emerald-400" />
          Current AI State
        </h3>

        <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col items-center gap-2 shadow-inner">
          <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Active Gesture</div>
          <div className="text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent uppercase tracking-wide">
            {currentGesture === 'none' ? 'Searching Hand…' : currentGesture.replace('-', ' ')}
          </div>
          <div className="text-xs text-slate-400 text-center font-medium mt-1 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
            Action:{' '}
            <span className="text-blue-400 font-semibold">
              {GESTURE_GUIDE.find((g) => g.gesture === currentGesture)?.action ?? 'None'}
            </span>
          </div>

          {/* MediaPipe FPS when camera is active */}
          {isCameraActive && (
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              fps >= 24 ? 'bg-emerald-900/60 text-emerald-400' :
              fps >= 12 ? 'bg-amber-900/60 text-amber-400' :
              'bg-rose-900/60 text-rose-400'
            }`}>
              AI Engine: {fps} FPS
            </div>
          )}
        </div>
      </div>

      {/* ── Gesture Cheat-sheet ───────────────────────────────────────────── */}
      <div className="p-4 flex-1">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3.5 flex items-center gap-1.5">
          <Info className="h-4 w-4 text-purple-400" />
          Gesture Control Manual
        </h3>

        <div className="flex flex-col gap-2.5">
          {GESTURE_GUIDE.map((item) => (
            <div
              key={item.gesture}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                currentGesture === item.gesture
                  ? 'bg-blue-950/40 border-blue-800/80 shadow-md'
                  : 'bg-slate-950/30 border-slate-800 hover:bg-slate-950/60'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-slate-200">{item.name}</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md">
                  <Keyboard className="h-2.5 w-2.5" />
                  {item.key}
                </span>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mb-0.5">
                {item.action}
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
