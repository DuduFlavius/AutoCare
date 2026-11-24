import { useEffect, useMemo, useRef, useState } from 'react';
import { localOffset, matchRoadSpeed, speedRoadRadius, speedWarning, type SpeedRoad } from '@/lib/road-speed-limit';
import type { GPSFix } from '@/lib/gps-tracking';

const initialWarning = {limit:null,first:null,active:false};
const preferenceKey = 'autocare.smartdrive.speed-warning';

export function useRoadSpeed(fix: GPSFix | null, speed: number | null, enabled: boolean) {
  const [sample,setSample] = useState<{center:GPSFix;roads:SpeedRoad[];expires:number}|null>(null);
  const [roads,setRoads] = useState<SpeedRoad[]>([]);
  const lastRequest = useRef<{center:GPSFix;at:number}|null>(null);
  const pending = useRef<AbortController | null>(null);
  const [warning,setWarning] = useState<ReturnType<typeof speedWarning>>(initialWarning);
  const [mode,setMode] = useState<'off'|'visual'|'sound'>('visual');
  const audio = useRef<AudioContext | null>(null);
  const lastSound = useRef(0);
  const valid = enabled && !!fix && fix.accuracy>=0 && fix.accuracy<=18;
  const coverage = valid && sample && sample.expires>Date.now() && Math.hypot(...localOffset(sample.center,fix.latitude,fix.longitude))<speedRoadRadius-36;
  const limit = useMemo(()=>coverage ? matchRoadSpeed(fix,sample.roads) : null,[coverage,fix,sample]);

  useEffect(()=>{
    try {
      const stored=localStorage.getItem(preferenceKey);
      if (stored==='off'||stored==='sound') setMode(stored);
    } catch { /* The preference can still be used in memory. */ }
    return ()=>{void audio.current?.close().catch(()=>{});};
  },[]);

  useEffect(()=>{
    if (!enabled || mode!=='sound' || audio.current?.state==='running') return;
    function unlock() {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(()=>{});
      } catch { /* Audio may be unavailable on this device. */ }
    }
    window.addEventListener('click',unlock,{once:true});
    return ()=>window.removeEventListener('click',unlock);
  },[enabled,mode]);

  useEffect(()=>{
    if (!enabled) {
      pending.current?.abort();
      pending.current=null;
      lastRequest.current=null;
    }
    return ()=>{pending.current?.abort();pending.current=null;};
  },[enabled]);

  useEffect(()=>{
    if (!valid || pending.current) return;
    const now=Date.now();
    const last=lastRequest.current;
    if (last && now-last.at<3000) return;
    if (coverage && Math.hypot(...localOffset(sample.center,fix.latitude,fix.longitude))<82) return;
    if (last && now-last.at<18000 && Math.hypot(...localOffset(last.center,fix.latitude,fix.longitude))<45) return;
    const controller=new AbortController();
    pending.current=controller;
    lastRequest.current={center:fix,at:now};
    void fetch('/api/v1/smartdrive/speed-roads',{
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
      body:JSON.stringify({latitude:fix.latitude,longitude:fix.longitude}),
      signal:AbortSignal.any([controller.signal,AbortSignal.timeout(11000)]),
    }).then(async result=>{
      if (!result.ok) return;
      const roads=await result.json();
      if (!controller.signal.aborted && Array.isArray(roads)) {
        setSample({center:fix,roads,expires:Date.now()+120000});
        setRoads(previous=>{
          const byWay=new Map<number|string,SpeedRoad>();
          for(const road of [...previous,...roads] as SpeedRoad[]){
            const key=road.id??JSON.stringify(road.geometry);
            byWay.delete(key);
            byWay.set(key,road);
          }
          return Array.from(byWay.values()).slice(-160);
        });
      }
    }).catch(()=>{}).finally(()=>{if (pending.current===controller) pending.current=null;});
  },[valid,fix,coverage,sample]);

  useEffect(()=>{
    setWarning(previous=>speedWarning(previous,mode==='off'?null:limit,speed,fix?.timestamp??0));
  },[limit,speed,fix?.timestamp,mode]);

  const over = warning.active && limit===warning.limit && speed!==null && mode!=='off';
  useEffect(()=>{
    const context=audio.current;
    if (!over || mode!=='sound' || context?.state!=='running' || Date.now()-lastSound.current<30000) return;
    lastSound.current=Date.now();
    const tone=context.createOscillator(), volume=context.createGain();
    tone.frequency.value=660;
    volume.gain.setValueAtTime(0.075,context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001,context.currentTime+0.25);
    tone.connect(volume).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime+0.25);
  },[over,mode]);

  async function changeMode(next:typeof mode) {
    if (next==='sound') {
      try {
        audio.current ??= new AudioContext();
        await audio.current.resume();
      } catch {next='visual';}
    }
    setMode(next);
    try {localStorage.setItem(preferenceKey,next);} catch { /* Storage may be unavailable in this WebView. */ }
  }

  return {limit, over, mode, changeMode, roads};
}
