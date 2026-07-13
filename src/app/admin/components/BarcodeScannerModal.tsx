'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
};

export default function BarcodeScannerModal({ isOpen, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    const reader = new BrowserMultiFormatReader();

    // ✅ 'cancelled' evita que un escaneo detectado justo después de
    // cerrar el modal (o durante el doble-render de desarrollo de React)
    // siga disparando onScan o mantenga la cámara viva.
    let cancelled = false;
    let controls: IScannerControls | undefined;

    const stopCamera = () => {
      controls?.stop();
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result, err, ctrls) => {
          // El propio callback nos da el objeto 'controls' de ESTA sesión;
          // lo guardamos apenas llega para poder detenerla de verdad.
          controls = ctrls;

          // ✅ Si esta sesión ya fue cancelada (el modal se cerró antes de
          // que la cámara terminara de iniciar, algo común con el doble
          // montaje de React en desarrollo), se autodetiene apenas recibe
          // el primer fotograma, en vez de quedar huérfana para siempre.
          if (cancelled) {
            ctrls.stop();
            return;
          }

          if (result) {
            cancelled = true;
            stopCamera();
            onScan(result.getText());
          }
          // 'err' se dispara constantemente mientras no detecta nada;
          // eso es normal, no es un error real que mostrar al usuario.
        }
      )
      .catch((err) => {
        if (cancelled) return;
        console.error('No se pudo acceder a la cámara:', err);
        setError(
          'No se pudo acceder a la cámara. Revisa los permisos del navegador.'
        );
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-lg p-4 w-full max-w-sm text-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Escanear código</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full rounded bg-black aspect-square object-cover"
            muted
            playsInline
          />
        )}

        <p className="text-xs text-gray-500 mt-2 text-center">
          Apunta la cámara al código de barras o QR del producto.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 rounded border"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
