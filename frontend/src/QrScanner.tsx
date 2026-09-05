import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorInstance;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: BarcodeDetectorConstructor;
}

interface QrScannerProps {
  label: string;
  onDetected: (value: string) => void;
}

export default function QrScanner({ label, onDetected }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      const barcodeDetector = (window as WindowWithBarcodeDetector).BarcodeDetector;

      if (!barcodeDetector) {
        setMessage("QR camera scanning is not supported in this browser. Use Chrome or enter the QR value manually.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanLoop(new barcodeDetector({ formats: ["qr_code"] }));
        }
      } catch {
        setMessage("Camera permission was denied or no camera was found.");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen]);

  function stopCamera() {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function scanLoop(detector: BarcodeDetectorInstance) {
    if (!videoRef.current) {
      return;
    }

    try {
      const results = await detector.detect(videoRef.current);
      const qrValue = results[0]?.rawValue;

      if (qrValue) {
        onDetected(qrValue);
        setMessage(`QR detected: ${qrValue}`);
        setIsOpen(false);
        return;
      }
    } catch {
      setMessage("Unable to scan this frame. Keep the QR code steady and well lit.");
    }

    frameRef.current = requestAnimationFrame(() => {
      void scanLoop(detector);
    });
  }

  return (
    <div className="qr-scanner">
      <button type="button" className="secondary-button" onClick={() => setIsOpen(true)}>
        <Camera size={16} />
        {label}
      </button>

      {isOpen && (
        <div className="camera-panel">
          <div className="camera-header">
            <strong>Point camera at QR code</strong>
            <button type="button" className="icon-button" onClick={() => setIsOpen(false)} aria-label="Close scanner">
              <X size={18} />
            </button>
          </div>
          <video ref={videoRef} className="camera-preview" muted playsInline />
          <p>Scanning automatically. Keep the QR code inside the camera view.</p>
        </div>
      )}

      {message && <p className="scanner-message">{message}</p>}
    </div>
  );
}
