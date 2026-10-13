import { useEffect, useState } from 'react';
import { toString as renderQr } from 'qrcode';

export function ParticipantQr({ url }: { url: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    renderQr(url, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'Q',
      color: { dark: '#14171c', light: '#f3efe6' },
    })
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <figure className="qr-block">
      <div className="qr-card">
        {src ? (
          <img src={src} alt="QR code that opens the participant link" />
        ) : (
          <div className="qr-placeholder" aria-hidden="true" />
        )}
      </div>
      <figcaption>Scan to add a word</figcaption>
    </figure>
  );
}
