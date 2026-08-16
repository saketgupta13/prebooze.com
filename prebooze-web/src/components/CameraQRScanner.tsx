import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

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
      ?.getUserMedia({ video: { facingMode: 'environment' } })
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
        const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
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
