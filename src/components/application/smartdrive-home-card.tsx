'use client';
import {useEffect,useState} from 'react';
import {ChevronRight,Clock3,Navigation} from 'lucide-react';
import {driveDistance,driveDuration} from '@/lib/drive-display';
import {hasNativeTracking,nativeTracking} from '@/lib/native-tracking';
import {useApplicationLanguage,useApplicationLocale} from '../application-locale';

type SessionSummary={meters:number;seconds:number;paused:boolean};

export default function SmartDriveHomeCard({ownerId,preview,onOpen}:{ownerId:string;preview:boolean;onOpen:()=>void}){
 const [session,setSession]=useState<SessionSummary|null>(null);
 const english=useApplicationLanguage()==='en',locale=useApplicationLocale();
 useEffect(()=>{
  if(preview||!ownerId||!hasNativeTracking())return;
  let disposed=false,inFlight=false;
  async function refresh(){
   if(disposed||inFlight||document.visibilityState!=='visible')return;
   inFlight=true;
   try{
    const value=await nativeTracking.snapshot(ownerId);
    if(disposed)return;
    if(!value?.active||value.endedAt){setSession(null);return;}
    const end=value.disconnectedAt??Date.now();
    const paused=(value.pausedMillis??0)+(value.pausedAt?Math.max(0,end-value.pausedAt):0);
    setSession({meters:value.stopAt?(value.disconnectDistance??value.distance):value.distance,
     seconds:value.awaitingMotion?0:Math.max(0,(end-value.startedAt-paused)/1000),paused:!!value.paused});
   }catch{if(!disposed)setSession(null);}
   finally{inFlight=false;}
  }
  void refresh();
  const timer=window.setInterval(()=>void refresh(),2000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{disposed=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[ownerId,preview]);
 const distance=session&&driveDistance(session.meters,locale);
 const status=session?.paused?(english?'Session paused':'Sesiune în pauză'):(english?'Session active':'Sesiune activă');
 return <section className="ac-home-smartdrive-compact" aria-label="SmartDrive GPS">
  <button type="button" onClick={onOpen} aria-label={session?(english?'Return to SmartDrive session':'Revino la sesiunea SmartDrive'):(english?'Open SmartDrive':'Deschide SmartDrive')}>
   <span className="ac-home-smartdrive-symbol"><Navigation size={21} aria-hidden="true"/></span>
   <span className="ac-home-smartdrive-content">
    <strong>SmartDrive GPS</strong>
    <span>{english?'Navigation and intelligent tracking':'Navigație și monitorizare inteligentă'}</span>
    {!session&&<span className="ac-home-smartdrive-mobile-label">{english?'Open SmartDrive':'Deschide SmartDrive'}</span>}
    {session&&distance&&<span className="ac-home-smartdrive-metrics" data-paused={session.paused}><b>{status}</b><span>{distance.value} {distance.unit}</span><span><Clock3 size={12} aria-hidden="true"/>{driveDuration(session.seconds)}</span></span>}
   </span>
   <span className="ac-home-smartdrive-action"><span>{session?(english?'Return to session':'Revino la sesiune'):(english?'Open SmartDrive':'Deschide SmartDrive')}</span><ChevronRight size={19} aria-hidden="true"/></span>
  </button>
 </section>;
}
