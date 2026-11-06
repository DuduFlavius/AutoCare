'use client';
import {Bluetooth,Clock3,Gauge,MapPin} from 'lucide-react';
import {driveDistance,driveDuration} from '@/lib/drive-display';
export default function DriveSessionSummary({distance,seconds,phase,accuracy,english}:{distance:number;seconds:number;phase:'ready'|'waiting'|'driving'|'reconnecting'|'saved'|'saving';accuracy:number|null;english:boolean}){
 const metric=driveDistance(distance,english?'en-GB':'ro-RO');
 const labels={ready:english?'Ready for your next drive':'Pregătit pentru următorul drum',waiting:english?'Car connected · waiting for movement':'Mașină conectată · așteaptă deplasarea',driving:english?'Trip in progress':'Călătorie în desfășurare',reconnecting:english?'Reconnecting · distance paused':'Reconectare · kilometrii sunt opriți',saved:english?'Trip saved':'Călătorie salvată',saving:english?'Saving your trip':'Se salvează călătoria'};
 return <div className={'drive-session drive-session--'+phase} data-workspace-ui>
  <div className="drive-session-status" role="status"><span className="drive-session-dot"/><Bluetooth size={16}/>{labels[phase]}</div>
  <div className="drive-session-distance"><span>{metric.value}</span><small>{metric.unit}</small></div>
  <p className="drive-session-caption">{english?'GPS distance estimate':'Distanță estimată prin GPS'}</p>
  <div className="drive-session-details">
   <div><Clock3 size={18}/><span>{english?'Driving time':'Durată de condus'}</span><strong>{driveDuration(phase==='waiting'?0:seconds)}</strong></div>
   <div><Gauge size={18}/><span>{english?'Measured distance':'Distanță măsurată'}</span><strong>{metric.meters.toLocaleString(english?'en-GB':'ro-RO')} m</strong></div>
   <div><MapPin size={18}/><span>{english?'GPS accuracy':'Precizie GPS'}</span><strong>{accuracy!=null&&Number.isFinite(accuracy)?'± '+Math.round(accuracy)+' m':'—'}</strong></div>
  </div>
 </div>;
}
