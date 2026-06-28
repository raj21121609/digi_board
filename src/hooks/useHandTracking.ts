import { useEffect, useState, useRef, useCallback } from 'react';

export type GestureType = 'pointing' | 'eraser' | 'fist' | 'pinch' | 'two-fingers' | 'none';

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentGesture, setCurrentGesture] = useState<GestureType>('none');
  const [fps, setFps] = useState<number>(0);
  const [landmarks, setLandmarks] = useState<HandLandmark[] | null>(null);

  // References for keeping track of variables in animation frames
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const fpsIntervalRef = useRef<number[]>([]);
  const simulatedGestureRef = useRef<GestureType>('none');

  // Dynamic script loader for MediaPipe Hands
  useEffect(() => {
    let active = true;

    const loadScripts = async () => {
      try {
        if (!window.hasOwnProperty('Hands')) {
          const cameraScript = document.createElement('script');
          cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
          cameraScript.async = true;
          cameraScript.crossOrigin = 'anonymous';
          document.head.appendChild(cameraScript);

          const handsScript = document.createElement('script');
          handsScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
          handsScript.async = true;
          handsScript.crossOrigin = 'anonymous';
          document.head.appendChild(handsScript);

          await Promise.all([
            new Promise((resolve) => { cameraScript.onload = resolve; }),
            new Promise((resolve) => { handsScript.onload = resolve; })
          ]);
        }

        if (active) {
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load MediaPipe scripts:', err);
        if (active) {
          setCameraError('Failed to load gesture recognition engine.');
        }
      }
    };

    loadScripts();

    // Listen to keyboard for simulating gestures (makes testing/usage without camera seamless)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        simulatedGestureRef.current = 'pointing';
        setCurrentGesture('pointing');
      } else if (e.key === '2') {
        simulatedGestureRef.current = 'eraser';
        setCurrentGesture('eraser');
      } else if (e.key === '3') {
        simulatedGestureRef.current = 'fist';
        setCurrentGesture('fist');
      } else if (e.key === '4') {
        simulatedGestureRef.current = 'two-fingers';
        setCurrentGesture('two-fingers');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        simulatedGestureRef.current = 'none';
        setCurrentGesture('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Distance helper
  const getDistance = (p1: HandLandmark, p2: HandLandmark) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // Process Hand Landmarks to detect Gestures
  const processLandmarks = useCallback((pts: HandLandmark[]) => {
    setLandmarks(pts);

    // Tip points and knuckle bases
    // Thumb: tip 4, IP joint 3, base 2
    // Index: tip 8, PIP joint 6, MCP joint 5
    // Middle: tip 12, PIP joint 10, MCP joint 9
    // Ring: tip 16, PIP joint 14, MCP joint 13
    // Pinky: tip 20, PIP joint 18, MCP joint 17
    
    // Note: Y coordinates are inverted in camera image space (smaller y = higher up)
    const isIndexOpen = pts[8].y < pts[6].y;
    const isMiddleOpen = pts[12].y < pts[10].y;
    const isRingOpen = pts[16].y < pts[14].y;
    const isPinkyOpen = pts[20].y < pts[18].y;
    
    // Thumb open: Check if thumb is spread out from index MCP (horizontal spread)
    // const _isThumbOpen = getDistance(pts[4], pts[5]) > getDistance(pts[3], pts[5]);

    // Pinch: Thumb tip (4) and Index tip (8) are extremely close
    const pinchDist = getDistance(pts[4], pts[8]);
    const isPinch = pinchDist < 0.055;

    // Gesture classifications:
    if (isPinch) {
      return 'pinch';
    } else if (isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen) {
      return 'eraser'; // Open Hand
    } else if (!isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
      return 'fist';   // Closed Fist
    } else if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen) {
      return 'two-fingers'; // Two fingers selection
    } else if (isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
      return 'pointing';    // Pointing
    }

    return 'none';
  }, []);

  const onResults = useCallback((results: any) => {
    // Calculate FPS
    const now = performance.now();
    fpsIntervalRef.current.push(now);
    // Keep only timestamps within last 1 second
    fpsIntervalRef.current = fpsIntervalRef.current.filter(t => now - t < 1000);
    setFps(fpsIntervalRef.current.length);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const detectedGesture = processLandmarks(results.multiHandLandmarks[0]);
      
      // If user isn't overriding with keys, set current gesture
      if (simulatedGestureRef.current === 'none') {
        setCurrentGesture(detectedGesture);
      }
    } else {
      setLandmarks(null);
      if (simulatedGestureRef.current === 'none') {
        setCurrentGesture('none');
      }
    }
  }, [processLandmarks]);

  const startCamera = useCallback(async () => {
    if (!isLoaded) return;
    setCameraError(null);

    try {
      // 1. Initialize MediaPipe Hands if not done yet
      if (!handsRef.current) {
        const mpHands = (window as any).Hands;
        if (!mpHands) {
          throw new Error('Hands global variable not found.');
        }

        const handsInstance = new mpHands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        handsInstance.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7
        });

        handsInstance.onResults(onResults);
        handsRef.current = handsInstance;
      }

      // 2. Setup video element and start Camera
      const videoElement = videoRef.current;
      if (videoElement) {
        const mpCamera = (window as any).Camera;
        if (!mpCamera) {
          throw new Error('Camera global variable not found.');
        }

        const cameraInstance = new mpCamera(videoElement, {
          onFrame: async () => {
            if (handsRef.current) {
              await handsRef.current.send({ image: videoElement });
            }
          },
          width: 640,
          height: 480
        });

        await cameraInstance.start();
        cameraRef.current = cameraInstance;
        setIsCameraActive(true);
      } else {
        throw new Error('Video element not provided.');
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError(err.message || 'Could not start camera. Check permissions.');
      setIsCameraActive(false);
    }
  }, [isLoaded, videoRef, onResults]);

  const stopCamera = useCallback(async () => {
    if (cameraRef.current) {
      try {
        await cameraRef.current.stop();
      } catch (e) {
        console.error('Failed to stop camera:', e);
      }
      cameraRef.current = null;
    }
    setIsCameraActive(false);
    setLandmarks(null);
    setCurrentGesture('none');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return {
    isLoaded,
    isCameraActive,
    cameraError,
    currentGesture,
    fps,
    landmarks,
    startCamera,
    stopCamera,
  };
}
