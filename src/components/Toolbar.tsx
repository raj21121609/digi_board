import React from 'react';
import { 
  Pencil, 
  Eraser, 
  MousePointer, 
  Undo2, 
  Redo2, 
  Trash2, 
  Download,
  Minus,
  Plus
} from 'lucide-react';
import type { ToolType } from '../hooks/useWhiteboard';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  savePng: () => void;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Yellow
  '#a855f7', // Purple
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  undo,
  redo,
  clear,
  savePng,
}) => {
  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-5 z-20">
      {/* Drawing Tools Section */}
      <div className="flex flex-col gap-2 p-2 rounded-2xl glass-panel shadow-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80">
        {/* Selection Tool */}
        <button
          onClick={() => setTool('select')}
          title="Selection Tool (Shortcut: 4)"
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            currentTool === 'select'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30Scale'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
          }`}
        >
          <MousePointer className="h-5 w-5" />
        </button>

        {/* Pencil Tool */}
        <button
          onClick={() => setTool('pencil')}
          title="Pencil Tool (Shortcut: 1)"
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            currentTool === 'pencil'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
          }`}
        >
          <Pencil className="h-5 w-5" />
        </button>

        {/* Eraser Tool */}
        <button
          onClick={() => setTool('eraser')}
          title="Eraser Tool (Shortcut: 2)"
          className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
            currentTool === 'eraser'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
          }`}
        >
          <Eraser className="h-5 w-5" />
        </button>
      </div>

      {/* Colors & Styling Section */}
      {currentTool !== 'eraser' && currentTool !== 'select' && (
        <div className="flex flex-col gap-3 p-3 rounded-2xl glass-panel shadow-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 items-center">
          {/* Stroke Width Slider */}
          <div className="flex flex-col items-center gap-1.5 border-b border-slate-200 dark:border-slate-700/50 pb-2.5 w-full">
            <button
              onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
              className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
              {strokeWidth}px
            </span>
            <button
              onClick={() => setStrokeWidth(Math.min(20, strokeWidth + 1))}
              className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Preset Colors */}
          <div className="grid grid-cols-2 gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setStrokeColor(c)}
                className={`w-6 h-6 rounded-full cursor-pointer border transition-all duration-150 ${
                  strokeColor === c 
                    ? 'border-slate-900 dark:border-white scale-110 shadow-sm' 
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Color Picker Input */}
          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-300/50">
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="absolute -inset-2 w-10 h-10 cursor-pointer p-0 border-0"
              title="Custom Color"
            />
          </div>
        </div>
      )}

      {/* History & Utility Actions Section */}
      <div className="flex flex-col gap-2 p-2 rounded-2xl glass-panel shadow-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80">
        {/* Undo */}
        <button
          onClick={undo}
          title="Undo (Ctrl+Z)"
          className="p-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
        >
          <Undo2 className="h-5 w-5" />
        </button>

        {/* Redo */}
        <button
          onClick={redo}
          title="Redo (Ctrl+Y)"
          className="p-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
        >
          <Redo2 className="h-5 w-5" />
        </button>

        {/* Clear Screen */}
        <button
          onClick={clear}
          title="Clear Canvas"
          className="p-3 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all duration-200 cursor-pointer"
        >
          <Trash2 className="h-5 w-5" />
        </button>

        {/* Save PNG */}
        <button
          onClick={savePng}
          title="Export as PNG"
          className="p-3 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-all duration-200 cursor-pointer"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
