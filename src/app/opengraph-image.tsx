import { ImageResponse } from 'next/og';
export const alt =
  'AutoCare — Mașina ta. Totul sub control. Documente, întreținere și cheltuieli auto, într-un singur loc.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';
export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#151B26',
        color: 'white',
        position: 'relative',
      }}
    >
      <svg width="620" height="630" viewBox="0 0 620 630" style={{position:'absolute',right:0,top:0}}>
        <defs><linearGradient id="carPaint" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#7db6ff"/><stop offset="1" stopColor="#1756c5"/></linearGradient></defs>
        <circle cx="400" cy="300" r="240" fill="#203f78" opacity=".7"/>
        <path d="M45 390 L115 350 L175 260 Q190 238 235 232 L410 225 Q450 225 474 260 L534 345 L579 372 Q592 385 590 421 L590 469 L40 469 L40 422 Q40 403 45 390Z" fill="url(#carPaint)" stroke="#a5ccff" strokeWidth="6"/>
        <path d="M190 271 L405 264 Q431 264 444 284 L489 348 L137 348Z" fill="#0c2247" stroke="#93bfff" strokeWidth="5"/>
        <path d="M320 268 L320 347" stroke="#7db6ff" strokeWidth="5"/>
        <path d="M48 399 L120 386 L131 417 L49 421Z M498 385 L582 403 L579 423 L490 419Z" fill="#e9f5ff"/>
        <circle cx="151" cy="465" r="61" fill="#101d31"/><circle cx="151" cy="465" r="31" fill="#a8bfd9"/>
        <circle cx="478" cy="465" r="61" fill="#101d31"/><circle cx="478" cy="465" r="31" fill="#a8bfd9"/>
        <path d="M32 527 L606 527" stroke="#6a9bde" strokeWidth="4" opacity=".6"/>
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background:
            'linear-gradient(90deg, #151B26 0%, #151B26 34%, rgba(21,27,38,0.88) 52%, rgba(21,27,38,0.05) 100%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 64px',
          width: '790px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 37, fontWeight: 700 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ marginRight: 14 }}>
            <rect width="48" height="48" rx="14" fill="#3478F6" />
            <path
              d="M12 31a14 14 0 1 1 24 0M24 24l8-8"
              stroke="white"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="24" cy="24" r="3" fill="white" />
          </svg>
          AutoCare<span style={{ color: '#3478F6' }}>.</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 66,
            flexDirection: 'column',
            fontSize: 60,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: '-2px',
          }}
        >
          <span>Mașina ta.</span>
          <span>Totul sub control.</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 26,
            color: '#C1CCDC',
            fontSize: 26,
            lineHeight: 1.45,
            maxWidth: 560,
          }}
        >
          Documente, întreținere și cheltuieli auto, într-un singur loc.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 45,
            fontSize: 19,
            color: '#91B6FF',
            letterSpacing: '2px',
          }}
        >
          GARAJUL TĂU DIGITAL
        </div>
      </div>
    </div>,
    size,
  );
}
