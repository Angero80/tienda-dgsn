'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function ViewInvoiceContent() {
  const params = useSearchParams();
  const url = params.get('url') || '';
  const label = params.get('label') || 'Documento';
  const isImage = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);

  useEffect(() => {
    document.title = label;
  }, [label]);

  if (!url) {
    return <div className="p-6">No se especificó un archivo para mostrar.</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: '#525659' }}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <iframe src={url} title={label} style={{ width: '100%', height: '100%', border: 'none' }} />
      )}
    </div>
  );
}

export default function ViewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <ViewInvoiceContent />
    </Suspense>
  );
}