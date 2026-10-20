import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const alt =
  'AutoCare — Mașina ta. Totul sub control. Documente, întreținere și cheltuieli auto, într-un singur loc.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';
export default async function Image() {
  const photo = await readFile(join(process.cwd(), 'public/design-car.jpg'));
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
      <img
        alt=""
        src={'data:image/jpeg;base64,' + photo.toString('base64')}
        width={680}
        height={630}
        style={{ position: 'absolute', right: 0, objectFit: 'cover', objectPosition: '65% 50%' }}
      />
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
