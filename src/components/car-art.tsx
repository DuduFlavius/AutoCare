import { useId } from 'react';

export function CarArt() {
  const id = useId();
  const body = id + '-body';
  const glass = id + '-glass';
  return (
    <svg className="car-art" viewBox="0 0 600 240" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="280" y1="60" x2="300" y2="190" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8BFB5" />
          <stop offset=".42" stopColor="#0B1C16" />
          <stop offset="1" stopColor="#10251E" />
        </linearGradient>
        <linearGradient id={glass} x1="270" y1="65" x2="300" y2="135">
          <stop stopColor="#091611" />
          <stop offset="1" stopColor="#1C8062" />
        </linearGradient>
      </defs>
      <ellipse cx="305" cy="201" rx="248" ry="14" fill="#000" opacity=".45" />
      <path
        d="M58 155 77 126 168 108 222 66Q236 56 266 56L360 58Q377 59 395 74L441 115 510 130 536 152 537 180 503 192 91 190 58 177Z"
        fill={`url(#${body})`}
        stroke="#A8BFB5"
      />
      <path
        d="m185 110 47-41 62-3 1 46Zm122 2-1-46 52 2 59 47Z"
        fill={`url(#${glass})`}
        stroke="#20E6A2"
      />
      <path
        d="m63 156 93-13 309 2 65 16M298 118v62M425 120l14 61M163 119l-22 56"
        stroke="#1C8062"
        strokeWidth="2"
      />
      <path d="m74 132 72-6-12 17-66 5Zm407 6 40 10 5 15-44-10Z" fill="#5AFFC4" />
      <path d="m73 167 58-8M473 171l54 4" stroke="#091611" strokeWidth="8" />
      <circle cx="164" cy="181" r="35" fill="#050E0B" stroke="#1C8062" strokeWidth="6" />
      <circle cx="164" cy="181" r="22" fill="#A8BFB5" />
      <circle cx="442" cy="181" r="35" fill="#050E0B" stroke="#1C8062" strokeWidth="6" />
      <circle cx="442" cy="181" r="22" fill="#A8BFB5" />
      {[164, 442].map((cx) => (
        <g key={cx} stroke="#10251E" strokeWidth="5">
          <path d={`M${cx} 162v38m-19-19h38m-32-13 26 26m-26 0 26-26`} />
        </g>
      ))}
      <path d="M205 128h22m97 0h22" stroke="#A8BFB5" strokeWidth="3" />
    </svg>
  );
}
