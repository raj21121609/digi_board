import React from 'react';
import { Camera, RefreshCw, ZoomIn, Move, CheckCircle } from 'lucide-react';
import type { GestureType } from '../hooks/useHandTracking';
import type { ViewState } from '../hooks/useWhiteboard';

interface StatusBarProps {
  isCameraActive: boolean;
  fps: number;
  currentGesture: GestureType;
  viewState: ViewState;
  elementsCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isCameraActive,
  fps,
  currentGesture,
  viewState,
  elementsCount,
}) => {
  // Determine FPS indicator color
  const getFpsColor = () => {
    if (!isCameraActive) return 'text-slate-500 bg-slate-800';
    if (fps >= 24) return 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/30';
    if (fps >= 12) return 'text-amber-400 bg-amber-950/40 border border-amber-900/30';
    return 'text-rose-400 bg-rose-950/40 border border-rose-900/30';
  };

  return (
    <footer className="h-8 w-full bg-slate-950 border-t border-slate-900 text-slate-400 text-xs px-6 flex items-center justify-between z-30 select-none">
      {/* Hand Gesture Engine Status */}
      <div className="flex items-center gap-4">
        {/* Camera Indicator */}
        <div className="flex items-center gap-2">
          <Camera className={`h-3.5 w-3.5 ${isCameraActive ? 'text-emerald-400' : 'text-slate-600'}`} />
          <span className="font-semibold text-slate-400">
            Camera: <span className={isCameraActive ? 'text-emerald-400' : 'text-slate-600 font-normal'}>
              {isCameraActive ? 'Active' : 'Offline'}
            </span>
          </span>
        </div>

        {/* FPS Counter */}
        {isCameraActive && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${getFpsColor()}`}>
            <RefreshCw className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '3s' }} />
            <span>{fps} FPS</span>
          </div>
        )}
      </div>

      {/* Current Gesture and Canvas Operations */}
      <div className="flex items-center gap-4">
        {/* Active Gesture Info */}
        <div className="flex items-center gap-1.5">
          <CheckCircle className={`h-3.5 w-3.5 ${currentGesture !== 'None' ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
          <span className="font-medium">
            Active Gesture: <span className={`font-bold uppercase ${currentGesture !== 'None' ? 'text-blue-400' : 'text-slate-500 font-normal'}`}>
              {currentGesture}
            </span>
          </span>
        </div>
      </div>

      {/* Canvas ViewState Coordinates & Zoom */}
      <div className="flex items-center gap-4">
        {/* Element Count */}
        <div className="text-slate-500 font-medium">
          Strokes: <span className="text-slate-300 font-bold">{elementsCount}</span>
        </div>

        {/* Pan coordinates */}
        <div className="flex items-center gap-1 text-slate-500">
          <Move className="h-3 w-3" />
          <span className="font-semibold text-[10px]">
            Pan: ({Math.round(viewState.pan.x)}, {Math.round(viewState.pan.y)})
          </span>
        </div>

        {/* Zoom Level */}
        <div className="flex items-center gap-1.5 font-bold text-slate-300">
          <ZoomIn className="h-3.5 w-3.5 text-blue-400" />
          <span>{Math.round(viewState.zoom * 100)}%</span>
        </div>
      </div>
    </footer>
  );
};
