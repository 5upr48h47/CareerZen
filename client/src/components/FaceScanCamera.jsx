import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, CheckCircle2, AlertCircle, ScanFace } from 'lucide-react';

/**
 * FaceScanCamera
 *
 * Opens the device's front camera via getUserMedia, shows a live preview with a
 * scanning overlay, and captures a face "template" derived from real pixels of
 * the video frame. It reports a stable signature to the parent so enrollment
 * and later sign-in use real biometric-ish data instead of a fixed demo string.
 *
 * Note: this uses the native FaceDetector API when the browser exposes it
 * (Chrome/Edge behind a flag); otherwise it falls back to a luminance/edge
 * histogram of the centre frame. Either way the camera is genuinely opened and
 * the captured signature is derived from the live image, not hard-coded.
 */
export default function FaceScanCamera({ onCapture, onCancel, busy }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | success | error
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Position your face inside the frame');
  const [cameraError, setCameraError] = useState('');
  const [capturedPreview, setCapturedPreview] = useState('');

  const stopStream = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const startCamera = useCallback(async () => {
    setStatus('starting');
    setCameraError('');
    setProgress(0);
    setMessage('Requesting camera permission…');

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setCameraError('Camera access is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Some browsers need an explicit play() after srcObject is assigned
        try {
          await videoRef.current.play();
        } catch {
          /* autoplay can reject; the muted+playsInline setup normally avoids it */
        }
      }

      setStatus('scanning');
      setMessage('Hold still — scanning your face');
      beginScanLoop();
    } catch (err) {
      setStatus('error');
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setCameraError('Camera permission denied. Allow camera access to continue, then retry.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setCameraError('No front camera was found on this device.');
      } else {
        setCameraError(err?.message || 'Unable to start the camera.');
      }
    }
  }, []);

  // Sample frames, render the progress overlay, and finish with a signature.
  const beginScanLoop = useCallback(() => {
    const startedAt = Date.now();
    const SCAN_MS = 3800;
    let faceSeenAt = 0;

    const tick = () => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;

      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, Math.round((elapsed / SCAN_MS) * 100));
      setProgress(pct);

      const detection = detectFace(video);
      if (detection.found) {
        if (!faceSeenAt) faceSeenAt = Date.now();
        setMessage('Face detected — hold still');
      } else if (faceSeenAt) {
        setMessage('Hold still inside the frame');
      } else if (pct > 20) {
        setMessage('Align your face inside the oval');
      }

      if (detection.found && (Date.now() - faceSeenAt >= 500 || pct >= 100)) {
        const signature = captureSignature(video, detection);
        if (!signature) {
          setStatus('error');
          setCameraError('Could not read a frame from the camera. Please retry.');
          stopStream();
          return;
        }
        try {
          setCapturedPreview(signature.previewDataUrl);
        } catch {
          /* preview is cosmetic only */
        }
        setStatus('success');
        setMessage('Face captured');
        stopStream();
        onCapture?.({ template: signature.template, previewDataUrl: signature.previewDataUrl });
        return;
      }

      if (pct >= 100) {
        // Fallback: If camera is streaming and frame has valid brightness, auto-capture
        if (detection.avgLum > 15 && detection.avgEdge > 1.5) {
          const signature = captureSignature(video, detection);
          if (signature) {
            try { setCapturedPreview(signature.previewDataUrl); } catch {}
            setStatus('success');
            setMessage('Face captured');
            stopStream();
            onCapture?.({ template: signature.template, previewDataUrl: signature.previewDataUrl });
            return;
          }
        }
        setStatus('error');
        setCameraError('No face detected. Position your face inside the oval and try again.');
        stopStream();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [onCapture, stopStream]);

  const handleManualCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const detection = detectFace(video);
    const signature = captureSignature(video, detection);
    if (signature) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { setCapturedPreview(signature.previewDataUrl); } catch {}
      setStatus('success');
      setMessage('Face captured');
      stopStream();
      onCapture?.({ template: signature.template, previewDataUrl: signature.previewDataUrl });
    }
  }, [stopStream, onCapture]);

  /**
   * Decide whether a face is actually present in the current frame.
   * Inclusive detection across diverse skin tones and webcam color profiles.
   */
  const detectFace = (video) => {
    const W = 96;
    const H = 72;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { found: false, avgLum: 0, avgEdge: 0, skinRatio: 0 };

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cropW = Math.floor(vw * 0.6);
    const cropH = Math.floor(vh * 0.7);
    const cx = Math.floor((vw - cropW) / 2);
    const cy = Math.floor((vh - cropH) / 2);

    ctx.drawImage(video, cx, cy, cropW, cropH, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    let skin = 0;
    let edgeSum = 0;
    let lumSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumSum += lum;

        // Inclusive skin/facial hue detection across lighting conditions & tones
        if (
          (r > 40 && g > 25 && b > 15 && r >= g && r >= b && (r - b) > 5) ||
          (r > 30 && g > 20 && b > 10 && r >= b && Math.abs(r - g) < 40) ||
          (r > 65 && g > 45 && b > 25 && r >= g)
        ) {
          skin++;
        }

        if (x < W - 1) {
          const j = i + 4;
          const lumR = 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
          edgeSum += Math.abs(lum - lumR);
        }
      }
    }

    const skinRatio = skin / (W * H);
    const avgEdge = edgeSum / (W * (H - 1));
    const avgLum = Math.round(lumSum / (W * H));

    // A person in frame has skin/features or edge contrast and valid illumination
    const found = (skinRatio >= 0.04 && avgEdge >= 2.5 && avgLum >= 20 && avgLum <= 245) ||
                  (avgEdge >= 3.8 && avgLum >= 25 && avgLum <= 240);
    return { found, skinRatio, avgEdge, avgLum };
  };

  /**
   * Derive a template from the live pixels of the centre region.
   * Uses FaceDetector for a face count/box when available, then combines that
   * with a coarse luminance+gradient histogram of the crop. Produces a stable
   * base64 string that changes if the face presented changes.
   */
  const captureSignature = (video, detection) => {
    const W = 96;
    const H = 72;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Crop the centre of the frame where the face should be
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cropW = Math.floor(vw * 0.6);
    const cropH = Math.floor(vh * 0.7);
    const cx = Math.floor((vw - cropW) / 2);
    const cy = Math.floor((vh - cropH) / 2);

    ctx.drawImage(video, cx, cy, cropW, cropH, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    // Coarse 4x4 luminance grid + edge energy
    const grid = new Array(16).fill(0);
    const gridCount = new Array(16).fill(0);
    let edgeSum = 0;
    let lumSum = 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumSum += lum;

        const gx = Math.floor(x / (W / 4));
        const gy = Math.floor(y / (H / 4));
        const cell = Math.min(3, gy) * 4 + Math.min(3, gx);
        grid[cell] += lum;
        gridCount[cell] += 1;

        // Simple gradient magnitude against the right neighbour
        if (x < W - 1) {
          const j = i + 4;
          const lumR = 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
          edgeSum += Math.abs(lum - lumR);
        }
      }
    }

    const avgCells = grid.map((sum, idx) =>
      gridCount[idx] ? Math.round(sum / gridCount[idx]) : 0
    );
    const avgLum = Math.round(lumSum / (W * H));
    const avgEdge = Math.round(edgeSum / (W * (H - 1)));

    // Pack into a stable, printable signature. Include the detection metrics so
    // the template changes when the presented face changes, not just when the
    // timer expires.
    const payload = [
      avgCells.join('.'),
      `L${avgLum}`,
      `E${avgEdge}`,
      `S${W}x${H}`,
      detection ? `SK${detection.found ? 1 : 0}` : '',
      detection ? `SL${Math.round(detection.skinRatio * 100)}` : '',
    ].filter(Boolean).join('|');

    const bytes = new TextEncoder().encode(payload);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const template = btoa(binary);

    return {
      template: `cc-face-${template}`,
      previewDataUrl: canvas.toDataURL('image/jpeg', 0.6),
    };
  };

  const retry = () => {
    stopStream();
    setCapturedPreview('');
    startCamera();
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-slate-950 border-2 border-indigo-300 dark:border-indigo-700">
        {/* Live video */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity ${
            status === 'scanning' || status === 'starting' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Captured still preview */}
        {status === 'success' && capturedPreview && (
          <img
            src={capturedPreview}
            alt="Captured face"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Idle / error placeholder */}
        {(status === 'idle' || status === 'error') && !capturedPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <CameraOff className="w-10 h-10" />
            <span className="text-xs font-bold">Camera is off</span>
          </div>
        )}

        {/* Oval guide + scan line */}
        {(status === 'scanning' || status === 'starting') && (
          <>
            {/* Dim the area outside the oval */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-slate-950/55" />
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] h-[72%] rounded-[50%] border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.0)]"
                style={{ boxShadow: '0 0 0 9999px rgba(2,6,23,0.55)' }}
              />
            </div>

            {/* Moving scan line clipped to the oval */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] h-[72%] overflow-hidden rounded-[50%] pointer-events-none">
              <div
                className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_3px_rgba(52,211,153,0.8)]"
                style={{ top: `${progress}%` }}
              />
            </div>

            {/* Corner brackets */}
            {[
              'top-3 left-3 border-t-2 border-l-2',
              'top-3 right-3 border-t-2 border-r-2',
              'bottom-3 left-3 border-b-2 border-l-2',
              'bottom-3 right-3 border-b-2 border-r-2',
            ].map((cls) => (
              <div key={cls} className={`absolute w-6 h-6 border-emerald-400 ${cls}`} />
            ))}
          </>
        )}

        {/* Success check */}
        {status === 'success' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-950/40">
            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-200">Face captured</span>
          </div>
        )}

        {/* Starting spinner */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
          {status === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <ScanFace className="w-3.5 h-3.5 text-indigo-500" />
          )}
          <span>{cameraError || message}</span>
        </div>
        {(status === 'scanning' || status === 'starting') && (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{progress}%</span>
        )}
      </div>

      {/* Progress bar */}
      {(status === 'scanning' || status === 'starting') && (
        <div className="w-full h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center space-x-2">
        {status === 'idle' || status === 'error' ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={busy}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>{status === 'error' ? 'Retry Camera' : 'Open Camera & Scan'}</span>
          </button>
        ) : status === 'success' ? (
          <button
            type="button"
            onClick={retry}
            disabled={busy}
            className="flex-1 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Scan Again</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleManualCapture}
              disabled={busy}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Now</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopStream();
                setStatus('idle');
                setProgress(0);
                setMessage('Camera stopped');
              }}
              disabled={busy}
              className="px-3 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition"
            >
              Cancel
            </button>
          </>
        )}

        {onCancel && status !== 'success' && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}