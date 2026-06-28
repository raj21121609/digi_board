import { useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { GestureSidebar } from './components/GestureSidebar';
import { StatusBar } from './components/StatusBar';
import { useWhiteboard } from './hooks/useWhiteboard';
import { useHandTracking } from './hooks/useHandTracking';

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize custom whiteboard drawing hooks
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

  // Initialize custom AI Hand gesture recognition hook
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

  const handleToggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Export Whiteboard contents to PNG file
  const handleSavePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas to burn a solid white background (since the canvas itself is transparent)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      // 1. Draw solid white background
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // 2. Draw canvas contents
      tempCtx.drawImage(canvas, 0, 0);

      // 3. Initiate client-side download
      const imageURL = tempCanvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = imageURL;
      downloadLink.download = `digiboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 select-none">
      {/* Top Navbar */}
      <Navbar
        isCameraActive={isCameraActive}
        cameraError={cameraError}
        onToggleCamera={handleToggleCamera}
        isModelLoaded={isModelLoaded}
      />

      {/* Main Workspace: Toolbar + Infinite Drawing Canvas + Right Control Panel */}
      <div className="flex flex-1 relative overflow-hidden h-[calc(100vh-4rem)]">
        {/* Left Vertical Floating Toolbar */}
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

        {/* Dynamic Infinite Whiteboard Canvas */}
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

        {/* Right Floating Sidebar with AI Status & Camera Feed preview */}
        <GestureSidebar
          isCameraActive={isCameraActive}
          landmarks={landmarks}
          currentGesture={currentGesture}
          videoRef={videoRef}
          onToggleCamera={handleToggleCamera}
        />
      </div>

      {/* Bottom Status bar */}
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
