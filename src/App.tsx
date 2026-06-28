import { useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { GestureSidebar } from './components/GestureSidebar';
import { StatusBar } from './components/StatusBar';
import { useWhiteboard } from './hooks/useWhiteboard';
import { useHandTracking } from './hooks/useHandTracking';
import type { WebcamViewHandle } from './components/WebcamView';

function App() {
  /**
   * webcamRef exposes the imperative handle of <WebcamView> so we can:
   *  - read webcamRef.current.videoElement  → fed into useHandTracking
   *  - read webcamRef.current.canvasElement → already-mirrored frames for ML
   *  - call start() / stop() programmatically from the Navbar button
   */
  const webcamRef = useRef<WebcamViewHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Build a stable videoRef that proxies into webcamRef ─────────────────
  // useHandTracking expects a React.RefObject<HTMLVideoElement|null>.
  // We create a stable ref object whose .current getter always reads
  // webcamRef.current.videoElement so the hook always has a live reference.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Sync on every render (cheap – just a property assignment)
  videoRef.current = webcamRef.current?.videoElement ?? null;

  // ── Whiteboard state ─────────────────────────────────────────────────────
  const {
    elements,
    currentTool,
    setCurrentTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    selectedElementId,
    setSelectedElementId,
    viewState,
    setViewState,
    undo,
    redo,
    clear,
    addStroke,
    moveElement,
    eraseAt,
    selectAt,
  } = useWhiteboard();

  // ── AI hand tracking (consumes the video element via videoRef) ───────────
  const {
    isLoaded: isModelLoaded,
    isCameraActive,
    cameraError,
    currentGesture,
    fps,
    landmarks,
    startCamera,
    stopCamera,
  } = useHandTracking(videoRef);

  // ── Camera toggle (wires Navbar button → useHandTracking) ────────────────
  const handleToggleCamera = useCallback(() => {
    if (isCameraActive) {
      stopCamera();
    } else {
      // Make sure the WebcamView's video is playing before starting MediaPipe
      webcamRef.current?.start().then(() => startCamera());
    }
  }, [isCameraActive, startCamera, stopCamera]);

  // Called by GestureSidebar's WebcamView onStart / onStop callbacks
  const handleWebcamStart = useCallback(() => {
    startCamera();
  }, [startCamera]);

  const handleWebcamStop = useCallback(() => {
    stopCamera();
  }, [stopCamera]);

  // ── Export whiteboard as PNG ─────────────────────────────────────────────
  const handleSavePng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `digiboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 select-none">
      {/* Top Navbar */}
      <Navbar
        isCameraActive={isCameraActive}
        cameraError={cameraError}
        onToggleCamera={handleToggleCamera}
        isModelLoaded={isModelLoaded}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 relative overflow-hidden h-[calc(100vh-4rem)]">
        {/* Left Floating Toolbar */}
        <Toolbar
          currentTool={currentTool}
          setTool={setCurrentTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          undo={undo}
          redo={redo}
          clear={clear}
          savePng={handleSavePng}
        />

        {/* Infinite Drawing Canvas */}
        <Canvas
          elements={elements}
          currentTool={currentTool}
          setTool={setCurrentTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          selectedElementId={selectedElementId}
          setSelectedElementId={setSelectedElementId}
          viewState={viewState}
          setViewState={setViewState}
          addStroke={addStroke}
          moveElement={moveElement}
          eraseAt={eraseAt}
          selectAt={selectAt}
          currentGesture={currentGesture}
          landmarks={landmarks}
          canvasRef={canvasRef}
        />

        {/* Right Sidebar — hosts WebcamView + gesture status */}
        <GestureSidebar
          isCameraActive={isCameraActive}
          landmarks={landmarks}
          currentGesture={currentGesture}
          webcamRef={webcamRef}
          onToggleCamera={handleToggleCamera}
          fps={fps}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        isCameraActive={isCameraActive}
        fps={fps}
        currentGesture={currentGesture}
        viewState={viewState}
        elementsCount={elements.length}
      />
    </div>
  );
}

export default App;
