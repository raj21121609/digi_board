import { useRef, useCallback, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { GestureSidebar } from './components/GestureSidebar';
import { StatusBar } from './components/StatusBar';
import { useWhiteboard } from './hooks/useWhiteboard';
import { useHandTracking } from './hooks/useHandTracking';
import { useWebcam } from './hooks/useWebcam';

function App() {
  // ── Whiteboard canvas ref ─────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Webcam (camera source) ────────────────────────────────────────────────
  // useWebcam owns the MediaStream. Its videoRef is piped into useHandTracking.
  const {
    videoRef,
    state: webcamState,
    start: startWebcam,
    stop: stopWebcam,
  } = useWebcam({ width: 640, height: 480 });

  // Derive simple booleans for child components
  const isCameraActive = webcamState.isActive;
  const cameraError    = webcamState.error;

  // ── AI hand tracking (consumes the video element via videoRef) ───────────
  const {
    isReady,
    isLoading: isModelLoading,
    error: modelError,
    currentGesture,
    landmarks,
    fps,
    startDetection,
    stopDetection,
  } = useHandTracking(videoRef);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  const handleToggleCamera = useCallback(async () => {
    if (isCameraActive) {
      stopDetection();
      stopWebcam();
    } else {
      await startWebcam();
      // Detection is started by the effect below once the model is ready —
      // calling startDetection() here would no-op if the model is still loading.
    }
  }, [isCameraActive, startWebcam, stopWebcam, stopDetection]);

  // Start detection only when BOTH the camera is live and the model is ready.
  // This handles the common case where the user clicks "Start" before the
  // MediaPipe model has finished loading.
  useEffect(() => {
    if (isCameraActive && isReady) {
      startDetection();
    }
  }, [isCameraActive, isReady, startDetection]);

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
        isModelLoaded={isReady}
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

        {/* Right Sidebar — hosts webcam feed + gesture status */}
        <GestureSidebar
          isCameraActive={isCameraActive}
          landmarks={landmarks}
          currentGesture={currentGesture}
          videoRef={videoRef}
          onToggleCamera={handleToggleCamera}
          fps={fps}
          modelLoading={isModelLoading}
          modelError={modelError}
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
