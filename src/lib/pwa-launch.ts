export const appleLaunchScreens=[
 {w:750,h:1334,dpr:2},{w:828,h:1792,dpr:2},{w:1125,h:2436,dpr:3},{w:1170,h:2532,dpr:3},{w:1179,h:2556,dpr:3},{w:1206,h:2622,dpr:3},{w:1290,h:2796,dpr:3},{w:1320,h:2868,dpr:3},
];
export const startupImages=appleLaunchScreens.map(({w,h,dpr})=>({url:`/apple-splash?w=${w}&h=${h}&v=pearl5`,media:`(device-width: ${w/dpr}px) and (device-height: ${h/dpr}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`}));
