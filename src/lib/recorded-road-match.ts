import {segmentMeters, type GPSFix} from './gps-tracking';
import {localOffset, type SpeedRoad} from './road-speed-limit';

const roadBounds=new WeakMap<SpeedRoad,number[]>();
function closeToRoad(fix:GPSFix,road:SpeedRoad) {
  let bounds=roadBounds.get(road);
  if(!bounds){
    bounds=[90,180,-90,-180];
    for(const {lat,lon} of road.geometry){
      bounds[0]=Math.min(bounds[0],lat);
      bounds[1]=Math.min(bounds[1],lon);
      bounds[2]=Math.max(bounds[2],lat);
      bounds[3]=Math.max(bounds[3],lon);
    }
    roadBounds.set(road,bounds);
  }
  const lat=Math.max(bounds[0],Math.min(bounds[2],fix.latitude));
  const lon=Math.max(bounds[1],Math.min(bounds[3],fix.longitude));
  return Math.hypot(...localOffset(fix,lat,lon))<=12;
}

function project(fix: GPSFix, road: SpeedRoad) {
  let best: {index:number;fraction:number;error:number;coordinate:number[];bearing:number} | undefined;
  for(let index=0;index<road.geometry.length-1;index++){
    const start=road.geometry[index],end=road.geometry[index+1];
    const [x, y] = localOffset(fix, start.lat, start.lon);
    const [endX, endY] = localOffset(fix, end.lat, end.lon);
    const dx = endX-x, dy = endY-y;
    const length = dx*dx+dy*dy;
    if (!length) continue;
    const fraction = Math.max(0, Math.min(1, -(x*dx+y*dy)/length));
    const error = Math.hypot(x+dx*fraction,y+dy*fraction);
    if (error > Math.min(12,Math.max(4,fix.accuracy)) || (best && best.error<=error)) continue;
    best={index,fraction,error,coordinate:[start.lon+(end.lon-start.lon)*fraction,start.lat+(end.lat-start.lat)*fraction],bearing:Math.atan2(dx,dy)*180/Math.PI};
  }
  return best;
}

type Edge={to:number; meters:number; coordinate:number[]};
const graphs=new WeakMap<readonly SpeedRoad[],Map<number,Edge[]>>();
const coordinate=({lon,lat}:SpeedRoad['geometry'][number])=>[lon,lat];
const distance=([longitude,latitude]:number[],[x,y]:number[])=>segmentMeters({longitude,latitude},{longitude:x,latitude:y});

function directions(road:SpeedRoad){
  const oneway=road.tags['oneway:motorcar'] ?? road.tags.oneway ?? (road.tags.junction==='roundabout'?'yes':undefined);
  return [true,false].filter(forward=>!(oneway==='-1'&&forward)&&!(['yes','1','true'].includes(oneway??'')&&!forward));
}

function roadGraph(roads:readonly SpeedRoad[]){
  const cached=graphs.get(roads);
  if(cached)return cached;
  const graph=new Map<number,Edge[]>();
  for(const road of roads){
    if(road.nodes?.length!==road.geometry.length)continue;
    for(let i=1;i<road.nodes.length;i++){
      for(const forward of directions(road)){
        const [from,to]=forward?[i-1,i]:[i,i-1];
        const a=coordinate(road.geometry[from]), b=coordinate(road.geometry[to]);
        const edges=graph.get(road.nodes[from])??[];
        edges.push({to:road.nodes[to],meters:distance(a,b),coordinate:b});
        graph.set(road.nodes[from],edges);
      }
    }
  }
  graphs.set(roads,graph);
  return graph;
}

function anchors(fix:GPSFix,roads:readonly SpeedRoad[],departing:boolean){
  return roads.flatMap(road=>{
    if(road.nodes?.length!==road.geometry.length||!closeToRoad(fix,road))return [];
    const point=project(fix,road);
    if(!point)return [];
    return directions(road).flatMap(forward=>{
      if(!headingAgrees(fix,point.bearing+(forward?0:180)))return [];
      const index=point.index+(forward===departing?1:0);
      const endpoint=coordinate(road.geometry[index]);
      return [{point,node:road.nodes![index],opposite:road.nodes![point.index+(index===point.index?1:0)],endpoint,meters:distance(point.coordinate,endpoint)}];
    });
  });
}

function mappedConnections(start:GPSFix,end:GPSFix,roads:readonly SpeedRoad[],budget:number) {
  const graph=roadGraph(roads);
  const arrivals=anchors(end,roads,false);
  const candidates:{coordinates:number[][];error:number}[]=[];
  let visited=0;
  for(const from of anchors(start,roads,true)){
    const walk=(node:number,meters:number,path:number[][],seen:Set<number>)=>{
      if(meters>budget||++visited>160)return;
      for(const to of arrivals){
        if(to.node!==node||meters+to.meters>budget||meters+to.meters<1)continue;
        const points=[...path,to.point.coordinate].filter((point,i,list)=>i===0||distance(point,list[i-1])>.05);
        if(points.length>1)candidates.push({coordinates:points,error:from.point.error+to.point.error});
      }
      for(const edge of graph.get(node)??[]){
        if(seen.has(edge.to))continue;
        walk(edge.to,meters+edge.meters,[...path,edge.coordinate],new Set([...seen,edge.to]));
      }
    };
    walk(from.node,from.meters,[from.point.coordinate,from.endpoint],new Set([from.node,from.opposite]));
  }
  // An incomplete search cannot establish that a connection is unique.
  return visited>160?null:candidates;
}

function headingAgrees(fix: GPSFix, bearing: number) {
  return fix.heading == null || (fix.speed ?? 0)<2 ||
    Math.abs(((fix.heading-bearing+540)%360)-180)<=50;
}

/** Match recent observations using mapped shapes and shared OSM nodes only. */
export function matchRecordedRoadLink(start: GPSFix, end: GPSFix, roads: readonly SpeedRoad[]): number[][] | null {
  const seconds=(end.timestamp-start.timestamp)/1000;
  if(seconds<=0||seconds>8||end.breakBefore)return null;
  const direct=segmentMeters(start,end);
  const budget=Math.min(direct*1.45+8,seconds*55);
  const connections=mappedConnections(start,end,roads,budget);
  if(!connections)return null;
  const candidates = roads.flatMap(road=>{
    if(!closeToRoad(start,road)||!closeToRoad(end,road))return [];
    const a=project(start,road), b=project(end,road);
    if(!a||!b)return [];
    const forward=a.index+a.fraction<b.index+b.fraction;
    if (!directions(road).includes(forward)) return [];
    if(!headingAgrees(start,a.bearing+(forward?0:180))||!headingAgrees(end,b.bearing+(forward?0:180))) return [];
    const from = forward?a:b, to = forward?b:a;
    const between=road.geometry.slice(from.index+1,to.index+1).map(node=>[node.lon,node.lat]);
    const coordinates=[from.coordinate,...between,to.coordinate];
    const meters=coordinates.slice(1).reduce((sum,[longitude,latitude],index)=>
      sum+segmentMeters({longitude,latitude},{longitude:coordinates[index][0],latitude:coordinates[index][1]}),0);
    if(meters<1||meters>budget) return [];
    return [{coordinates:forward?coordinates:coordinates.reverse(),error:a.error+b.error}];
  });
  const unique=new Map<string,{coordinates:number[][];error:number}>();
  for(const candidate of [...candidates,...connections]){
    const coordinates=candidate.coordinates.filter((point,i,list)=>i===0||distance(point,list[i-1])>.05);
    const key=coordinates.map(point=>point.map(value=>value.toFixed(7)).join(',')).join(';');
    if(coordinates.length>1&&candidate.error<(unique.get(key)?.error??Infinity))unique.set(key,{coordinates,error:candidate.error});
  }
  const ranked=Array.from(unique.values()).sort((a,b)=>a.error-b.error);
  if(!ranked.length || (ranked[1] && ranked[1].error-ranked[0].error<Math.max(7,start.accuracy,end.accuracy)))return null;
  return ranked[0].coordinates;
}
