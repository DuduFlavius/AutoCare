export type MapQuality = 'auto' | 'performance' | 'balanced' | 'premium';
export type RenderQuality = Exclude<MapQuality, 'auto'>;

export const renderQuality = {
  performance: {pixelRatio:1, cameraMs:1000/30, pitch:0, buildings:false, poi:false},
  balanced: {pixelRatio:1.5, cameraMs:1000/30, pitch:38, buildings:false, poi:true},
  premium: {pixelRatio:2, cameraMs:0, pitch:65, buildings:true, poi:true},
} satisfies Record<RenderQuality,{pixelRatio:number;cameraMs:number;pitch:number;buildings:boolean;poi:boolean}>;

export function readMapQuality(value:unknown):MapQuality {
  return value==='performance'||value==='balanced'||value==='premium'?value:'auto';
}

export function automaticMapQuality(memory?:number, concurrency?:number):RenderQuality {
  return memory!==undefined&&memory<=3||concurrency!==undefined&&concurrency<=4?'performance':'balanced';
}
