import { useId } from 'react';

export function TitaniumWave() {
  const id = useId();
  return (
    <svg className="ac-titanium-wave" viewBox="0 0 960 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id}>
          <stop stopColor="#1456c9" stopOpacity="0" />
          <stop offset=".42" stopColor="#398bff" />
          <stop offset=".67" stopColor="#56d6e8" />
          <stop offset="1" stopColor="#398bff" stopOpacity=".06" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`}>
        {Array.from({ length: 13 }, (_, index) => (
          <path
            key={index}
            opacity={index === 4 ? .74 : .22 - index * .01}
            strokeWidth={index === 4 ? 2 : 1}
            d={`M-60 ${327 + index * 7} C 244 ${368 - index * 4}, 352 ${69 + index * 13}, 550 ${126 + index * 5} S 807 ${124 - index * 6}, 1030 ${-41 + index * 15}`}
          />
        ))}
      </g>
    </svg>
  );
}
