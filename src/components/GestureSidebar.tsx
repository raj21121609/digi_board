import React, { useRef, useEffect } from 'react';
import { Eye, Info, Video, Keyboard } from 'lucide-react';
import type { GestureType, HandLandmark } from '../hooks/useHandTracking';
import { WebcamView } from './WebcamView';
import type { WebcamViewHandle } from './WebcamView';

interface GestureSidebarProps {
  isCameraActive: boolean;
  landmarks: HandLandmark[] | null;
  currentGesture: GestureType;
  /** Forwarded so App can bind the same webcam control used by useHandTracking */
  webcamRef: React.RefObject<WebcamViewHandle | null>;
  onToggleCamera: () => void;
  fps: number;
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
  webcamRef,
  onToggleCamera,
  fps,
}) => {
  const landmarkCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Draw hand landmarks overlay ───────────────────────────────────────────
  useEffect(() => {
    const canvas = landmarkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    const drawConnection = (from: number, to: number) => {
      const p1 = landmarks[from];
      const p2 = landmarks[to];
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
      ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
      ctx.stroke();
    };

    ctx.strokeStyle = 'rgba(59,130,246,0.65)';
    ctx.lineWidth = 2.5;

    // Thumb
    [0,1,2,3].forEach((i) => drawConnection(i, i + 1));
    // Palm knuckle bar
    [[5,9],[9,13],[13,17]].forEach(([a, b]) => drawConnection(a, b));
    // Fingers
    [[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]].forEach((finger) => {
      for (let i = 0; i < finger.length - 1; i++) drawConnection(finger[i], finger[i + 1]);
    });

    // Joints
    landmarks.forEach((lm, idx) => {
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      const x = (1 - lm.x) * canvas.width;
      const y = lm.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, isTip ? 6 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = isTip ? '#10b981' : '#3b82f6';
      ctx.shadowColor = isTip ? '#10b981' : '#3b82f6';
      ctx.shadowBlur = 5;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, [landmarks]);

  return (
    <aside className="w-80 h-[calc(100vh-4rem)] bg-slate-900 border-l border-slate-800 flex flex-col z-20 overflow-y-auto">

      {/* ── WebcamView (reusable component) ─────────────────────────────── */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
          <Video className="h-4 w-4 text-blue-400" />
          Camera Feed
        </h3>

        {/* The WebcamView is rendered here and its imperative handle is exposed
            so App.tsx can call webcamRef.current.videoElement and pipe it into
            the gesture recognition module (useHandTracking). */}
        <div className="relative">
          <WebcamView
            ref={webcamRef}
            width={640}
            height={480}
            showFps={true}
            showResolution={false}
            showControls={true}
            startLabel="Start Hand Track"
            stopLabel="Stop Hand Track"
            onStart={onToggleCamera}
            onStop={onToggleCamera}
            className="w-full"
          />

          {/* Landmark skeleton overlay – sits on top of the webcam feed */}
          <canvas
            ref={landmarkCanvasRef}
            width={320}
            height={240}
            className="absolute inset-0 w-full pointer-events-none z-10"
            style={{ aspectRatio: '4/3' }}
          />
        </div>
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
