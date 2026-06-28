/**
 * useWebcam.ts
 * Manages the full lifecycle of a webcam MediaStream.
 * Attaches the stream to a provided <video> ref.
 *
 * Reusable — has no MediaPipe dependency.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebcamOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

export interface WebcamState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useWebcam(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: WebcamOptions = {}
): WebcamState {
  const { width = 640, height = 480, facingMode = 'user' } = options;

  const [isActive, setIsActive]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [stream, setStream]       = useState<MediaStream | null>(null);
  const streamRef                 = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsActive(false);
    setError(null);
  }, [videoRef]);

  const start = useCallback(async () => {
    if (isActive || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for metadata so width/height are available
        await new Promise<void>((resolve, reject) => {
          const vid = videoRef.current!;
          vid.onloadedmetadata = () => resolve();
          vid.onerror = () => reject(new Error('Video failed to load'));
        });
        await videoRef.current.play();
      }

      setIsActive(true);
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : err.message ?? 'Could not start camera.';
      setError(msg);
      stop();
    } finally {
      setIsLoading(false);
    }
  }, [isActive, isLoading, width, height, facingMode, videoRef, stop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { isActive, isLoading, error, stream, start, stop };
}
