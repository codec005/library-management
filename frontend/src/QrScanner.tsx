import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";

interface QrScannerProps {
  label: string;
  onDetected: (value: string) => void;
}

export default function QrScanner({ label, onDetected }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!videoRef.current) {
        return;
      }

      try {
        const reader = new BrowserQRCodeReader();
        controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (!result || cancelled) {
            return;
          }

          const qrValue = result.getText();
          onDetected(qrValue);
          setMessage(`QR detected: ${qrValue}`);
          setIsOpen(false);
        });
      } catch {
        setMessage("Camera permission was denied, no camera was found, or this page is not opened over HTTPS.");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen]);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
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
