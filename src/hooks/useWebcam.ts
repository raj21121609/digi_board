import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebcamOptions {
  /** Width hint for getUserMedia (default: 640) */
  width?: number;
  /** Height hint for getUserMedia (default: 480) */
  height?: number;
  /** Facing mode: 'user' = front cam, 'environment' = rear cam (default: 'user') */
  facingMode?: 'user' | 'environment';
  /**
   * Optional callback invoked on every animation frame with the live video element.
   * Use this to pipe frames into gesture recognition, ML models, etc.
   */
  onFrame?: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => void | Promise<void>;
}

export interface WebcamState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  fps: number;
  width: number;
  height: number;
}

export function useWebcam(options: WebcamOptions = {}) {
  const {
    width = 640,
    height = 480,
    facingMode = 'user',
    onFrame,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fpsTimestampsRef = useRef<number[]>([]);
  const onFrameRef = useRef(onFrame);

  // Keep onFrame ref in sync so callers can update it without re-mounting
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const [state, setState] = useState<WebcamState>({
    isActive: false,
    isLoading: false,
    error: null,
    fps: 0,
    width: 0,
    height: 0,
  });

  // ── Frame loop ────────────────────────────────────────────────────────────
  const startFrameLoop = useCallback(() => {
    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Mirror-draw the video frame onto the offscreen canvas so consumers
      // always receive the already-mirrored pixels.
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0);
          ctx.restore();
        }
      }

      // Invoke consumer callback with the live video + mirrored canvas
      if (onFrameRef.current && canvas) {
        try {
          await onFrameRef.current(video, canvas);
        } catch {
          // swallow per-frame errors so the loop never dies silently
        }
      }

      // Rolling 1-second FPS window
      const now = performance.now();
      fpsTimestampsRef.current.push(now);
      fpsTimestampsRef.current = fpsTimestampsRef.current.filter(t => now - t < 1000);
      setState(prev => ({ ...prev, fps: fpsTimestampsRef.current.length }));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (streamRef.current) return; // already running

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height }, facingMode },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();

        setState({
          isActive: true,
          isLoading: false,
          error: null,
          fps: 0,
          width: settings.width ?? width,
          height: settings.height ?? height,
        });

        startFrameLoop();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'No camera device found on this system.'
          : err instanceof Error
          ? err.message
          : 'Unknown error accessing camera.';

      setState(prev => ({ ...prev, isLoading: false, isActive: false, error: msg }));
    }
  }, [width, height, facingMode, startFrameLoop]);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    fpsTimestampsRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState({ isActive: false, isLoading: false, error: null, fps: 0, width: 0, height: 0 });
  }, []);

  // ── Capture snapshot ──────────────────────────────────────────────────────
  const captureSnapshot = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    state,
    start,
    stop,
    captureSnapshot,
  };
}
