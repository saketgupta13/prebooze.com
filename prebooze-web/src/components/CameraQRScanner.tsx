import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Otsu's method — finds the luminance threshold that best splits a frame's
 * pixels into two classes (maximizes between-class variance). Doesn't care
 * what the two colors actually are, only that there's a clear light/dark
 * split — which every ticket QR has, brand-colored or not. */
function otsuThreshold(luminance: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < luminance.length; i++) hist[luminance[i]]++;
  const total = luminance.length;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

/** Rewrites `data` (RGBA, in place) to pure black/white using Otsu's
 * threshold on each pixel's luminance — used as a fallback when a direct
 * jsQR pass fails. jsQR does its own generic greyscale conversion
 * internally, tuned for an arbitrary black-on-white code; on this app's
 * brand green-on-black ticket QR under real camera noise it can fail where
 * a phone's own native camera (confirmed on the same physical code) still
 * succeeds. Binarizing first removes the color ambiguity before jsQR ever
 * sees it, at the cost of an extra pass — acceptable for a modal scan
 * screen that isn't running in the background. */
function binarize(data: Uint8ClampedArray, width: number, height: number): void {
  const n = width * height;
  const luminance = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    luminance[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
  }
  const threshold = otsuThreshold(luminance);
  for (let i = 0; i < n; i++) {
    const v = luminance[i] > threshold ? 255 : 0;
    const o = i * 4;
    data[o] = v; data[o + 1] = v; data[o + 2] = v;
  }
}

/** Real camera-based QR scanner — requests the rear camera, decodes every
 * frame with jsQR (a real QR decoder, not a lookalike), and calls onScan
 * once per new code (won't re-fire on the same code every frame while it's
 * still in view). Pass `active={false}` to freeze scanning without tearing
 * down the camera stream (e.g. while a confirm screen is showing). */
export default function CameraQRScanner({ onScan, active = true }: { onScan: (data: string) => void; active?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      // No resolution/focus constraints previously — the browser was free to
      // default to something as low as 640x480, which often isn't sharp
      // enough to resolve a real ticket QR's modules at normal scanning
      // distance. `ideal` (not `exact`) so devices that can't hit these
      // still connect at their best available instead of failing outright.
      // `focusMode`/`advanced` continuous-autofocus keys are silently
      // ignored by browsers/devices that don't support them.
      ?.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1920 },
          focusMode: 'continuous',
          advanced: [{ focusMode: 'continuous' }],
        } as unknown as MediaTrackConstraints,
      })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => setError("Couldn't access the camera — check permissions, or use manual entry below."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (active && ctx && video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Ticket QR codes render brand-green modules on a black background
        // (see QRCode.tsx) — inverted luminance polarity vs. a standard
        // black-on-white code. jsQR must try both polarities per frame or
        // it never binarizes these correctly.
        let code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
        if (!code) {
          // Fall back to an Otsu-binarized copy — see binarize()'s comment.
          // Only runs on a failed direct attempt, so the common case (a
          // clean scan) pays no extra cost.
          const bin = new Uint8ClampedArray(frame.data);
          binarize(bin, frame.width, frame.height);
          code = jsQR(bin, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
        }
        if (code && code.data && code.data !== lastCodeRef.current) {
          lastCodeRef.current = code.data;
          onScan(code.data);
        } else if (!code) {
          lastCodeRef.current = ''; // out of view — next appearance (even a repeat) should fire again
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active]);

  if (error) {
    return <div className="tiny danger-text center" style={{ padding: 16 }}>{error}</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#000', borderRadius: 10, overflow: 'hidden' }}>
      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div
        style={{
          position: 'absolute', inset: '15%', border: '2px solid var(--accent, #9be13d)', borderRadius: 12,
          boxShadow: '0 0 0 2000px rgba(0,0,0,.35)', pointerEvents: 'none',
        }}
      />
      {!ready && (
        <div className="tiny muted center" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          Starting camera…
        </div>
      )}
    </div>
  );
}
