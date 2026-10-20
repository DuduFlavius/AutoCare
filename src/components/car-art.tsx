export function CarArt() {
  return (
    <svg className="car-art" viewBox="0 0 600 240" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="body" x1="280" y1="60" x2="300" y2="190" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b9c9c7" />
          <stop offset=".42" stopColor="#688082" />
          <stop offset="1" stopColor="#25373d" />
        </linearGradient>
        <linearGradient id="glass" x1="270" y1="65" x2="300" y2="135">
          <stop stopColor="#19252b" />
          <stop offset="1" stopColor="#557477" />
        </linearGradient>
      </defs>
      <ellipse cx="305" cy="201" rx="248" ry="14" fill="#000" opacity=".45" />
      <path
        d="M58 155 77 126 168 108 222 66Q236 56 266 56L360 58Q377 59 395 74L441 115 510 130 536 152 537 180 503 192 91 190 58 177Z"
        fill="url(#body)"
        stroke="#adbfbb"
      />
      <path
        d="m185 110 47-41 62-3 1 46Zm122 2-1-46 52 2 59 47Z"
        fill="url(#glass)"
        stroke="#718b8c"
      />
      <path
        d="m63 156 93-13 309 2 65 16M298 118v62M425 120l14 61M163 119l-22 56"
        stroke="#354d51"
        strokeWidth="2"
      />
      <path d="m74 132 72-6-12 17-66 5Zm407 6 40 10 5 15-44-10Z" fill="#d5ffbb" />
      <path d="m73 167 58-8M473 171l54 4" stroke="#17272e" strokeWidth="8" />
      <circle cx="164" cy="181" r="35" fill="#0b1118" stroke="#3c4b51" strokeWidth="6" />
      <circle cx="164" cy="181" r="22" fill="#9ba9ab" />
      <circle cx="442" cy="181" r="35" fill="#0b1118" stroke="#3c4b51" strokeWidth="6" />
      <circle cx="442" cy="181" r="22" fill="#9ba9ab" />
      {[164, 442].map((cx) => (
        <g key={cx} stroke="#28373f" strokeWidth="5">
          <path d={`M${cx} 162v38m-19-19h38m-32-13 26 26m-26 0 26-26`} />
        </g>
      ))}
      <path d="M205 128h22m97 0h22" stroke="#b0c0bd" strokeWidth="3" />
    </svg>
  );
}
