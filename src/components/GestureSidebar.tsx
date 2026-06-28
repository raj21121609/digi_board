import React, { useRef, useEffect } from 'react';
import { Camera, Eye, Info, Video, Keyboard } from 'lucide-react';
import type { GestureType, HandLandmark } from '../hooks/useHandTracking';

interface GestureSidebarProps {
  isCameraActive: boolean;
  landmarks: HandLandmark[] | null;
  currentGesture: GestureType;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onToggleCamera: () => void;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw hand landmarks on overlay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks) return;

    // Draw hand skeleton lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'; // Blue outline
    ctx.lineWidth = 3;

    // Helper to draw connection lines between landmark indices
    const drawConnection = (from: number, to: number) => {
      const p1 = landmarks[from];
      const p2 = landmarks[to];
      if (p1 && p2) {
        ctx.beginPath();
        // Mirror X coordinate since webcam is mirrored
        ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
        ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }
    };

    // Thumb connections
    drawConnection(0, 1);
    drawConnection(1, 2);
    drawConnection(2, 3);
    drawConnection(3, 4);

    // Finger connections
    const fingers = [
      [0, 5, 6, 7, 8],     // Index
      [0, 9, 10, 11, 12],  // Middle
      [0, 13, 14, 15, 16], // Ring
      [0, 17, 18, 19, 20], // Pinky
    ];

    // Draw knuckles connecting base
    drawConnection(5, 9);
    drawConnection(9, 13);
    drawConnection(13, 17);

    fingers.forEach((finger) => {
      for (let i = 0; i < finger.length - 1; i++) {
        drawConnection(finger[i], finger[i + 1]);
      }
    });

    // Draw joints
    landmarks.forEach((landmark, index) => {
      const x = (1 - landmark.x) * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();
      // Style tip index points differently
      const isTip = [4, 8, 12, 16, 20].includes(index);
      ctx.arc(x, y, isTip ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = isTip ? '#10b981' : '#3b82f6'; // Emerald tips, Blue joints
      ctx.fill();

      // Shadow glow effect
      ctx.shadowColor = isTip ? '#10b981' : '#3b82f6';
      ctx.shadowBlur = 4;
    });

    // Reset shadow
    ctx.shadowBlur = 0;
  }, [landmarks]);

  return (
    <aside className="w-80 h-[calc(100vh-4rem)] bg-slate-900 border-l border-slate-800 flex flex-col z-20 overflow-y-auto">
      {/* Webcam Monitoring Stream */}
      <div className="p-4 border-b border-slate-800 flex flex-col items-center">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1.5 self-start">
          <Video className="h-4 w-4 text-blue-400" />
          Camera Feed Preview
        </h3>

        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
          {/* Invisible active element, mirrored preview */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
              isCameraActive ? 'opacity-70' : 'opacity-0 pointer-events-none'
            }`}
            muted
            playsInline
          />

          {/* Landmarks Canvas Overlay */}
          <canvas
            ref={canvasRef}
            width={320}
            height={240}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />

          {!isCameraActive && (
            <div className="flex flex-col items-center gap-2 p-6 text-center z-0">
              <Camera className="h-8 w-8 text-slate-700 animate-pulse" />
              <p className="text-xs text-slate-500 max-w-[200px]">
                Camera Feed is Inactive. Click Navbar to toggle Hand Gestures.
              </p>
              <button
                onClick={onToggleCamera}
                className="mt-2 text-[10px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all cursor-pointer"
              >
                Enable Camera
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Gesture Detection Status */}
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-emerald-400" />
          Current AI State
        </h3>
        
        <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 flex flex-col items-center gap-2 shadow-inner">
          <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Active Gesture</div>
          <div className="text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent uppercase tracking-wide">
            {currentGesture === 'none' ? 'Searching Hand...' : currentGesture.replace('-', ' ')}
          </div>
          <div className="text-xs text-slate-400 text-center font-medium mt-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
            Action: <span className="text-blue-400 font-semibold">
              {GESTURE_GUIDE.find((g) => g.gesture === currentGesture)?.action || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Hand Gesture Instruction Guide Cheat Sheet */}
      <div className="p-4 flex-1">
        <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3.5 flex items-center gap-1.5">
          <Info className="h-4 w-4 text-purple-400" />
          Gesture Control Manual
        </h3>

        <div className="flex flex-col gap-3">
          {GESTURE_GUIDE.map((item) => (
            <div 
              key={item.gesture} 
              className={`p-3 rounded-xl border transition-all duration-200 ${
                currentGesture === item.gesture 
                  ? 'bg-blue-950/40 border-blue-800/80 shadow-md' 
                  : 'bg-slate-950/30 border-slate-850 hover:bg-slate-950/60'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-slate-200">{item.name}</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md">
                  <Keyboard className="h-2.5 w-2.5" />
                  Key: {item.key}
                </span>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mb-1">
                Action: {item.action}
              </div>
              <p className="text-[10px] text-slate-500 leading-normal font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
