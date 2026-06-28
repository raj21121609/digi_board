import React from 'react';
import { Camera, CameraOff, Layers } from 'lucide-react';

interface NavbarProps {
  isCameraActive: boolean;
  cameraError: string | null;
  onToggleCamera: () => void;
  isModelLoaded: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isCameraActive,
  cameraError,
  onToggleCamera,
  isModelLoaded,
}) => {
  return (
    <nav className="h-16 w-full bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-6 z-30 shadow-md">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
          <Layers className="h-6 w-6 text-white animate-pulse" />
        </div>
        <div>
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            DigiBoard <span className="font-extrabold text-blue-400">AI</span>
          </span>
          <div className="text-[10px] text-slate-400 font-medium">Infinite Intelligent Canvas</div>
        </div>
      </div>

      {/* AI Camera & Hand Tracking Controller Status */}
      <div className="flex items-center gap-4">
        {/* Connection status badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
          <div className={`h-2.5 w-2.5 rounded-full ${isModelLoaded ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
          <span className="text-xs font-semibold text-slate-300">
            {isModelLoaded ? 'AI Engine Ready' : 'AI Engine Loading...'}
          </span>
        </div>

        {/* Toggle webcam control */}
        <button
          onClick={onToggleCamera}
          disabled={!isModelLoaded}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
            isCameraActive
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30'
              : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isCameraActive ? (
            <>
              <CameraOff className="h-4 w-4" />
              <span>Stop AI Hand Track</span>
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              <span>Start AI Hand Track</span>
            </>
          )}
        </button>

        {cameraError && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 px-3 py-1.5 rounded-lg max-w-xs truncate">
            {cameraError}
          </div>
        )}
      </div>

      {/* Quick shortcuts / branding */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 hidden md:block">
          Press keys <kbd className="text-blue-400 font-bold bg-slate-900 px-1 rounded">1-4</kbd> to simulate hand gestures
        </span>
      </div>
    </nav>
  );
};
