'use client';
import { Clock3, Gauge, MapPin, Radio, Route } from 'lucide-react';
import { driveDistance, driveDuration } from '@/lib/drive-display';
import type { GPSSignal } from '@/lib/gps-status';
type Phase = 'ready' | 'locating' | 'waiting' | 'driving' | 'reconnecting' | 'stopped' | 'saved' | 'saving';
export default function DriveSessionSummary({ distance, seconds, phase, accuracy, speed, signal, english }: {
  distance: number; seconds: number; phase: Phase; accuracy: number | null; speed: number | null; signal: GPSSignal; english: boolean;
}) {
  const t = (ro: string, en: string) => english ? en : ro;
  const metric = driveDistance(distance, english ? 'en-GB' : 'ro-RO');
  const measured = distance > 0 || phase === 'driving' || phase === 'saving' || phase === 'saved' || phase === 'stopped' && seconds > 0;
  const labels: Record<Phase, string> = {
    ready: t('Pregătit pentru următorul drum', 'Ready for your next drive'), locating: t('Se caută o poziție precisă', 'Waiting for a precise position'),
    waiting: t('Mașină conectată · așteaptă deplasarea', 'Car connected · waiting for movement'), driving: t('Călătorie în desfășurare', 'Trip in progress'),
    reconnecting: t('Reconectare · distanță întreruptă', 'Reconnecting · distance paused'), stopped: t('Călătorie oprită', 'Trip stopped'),
    saved: t('Călătorie salvată', 'Trip saved'), saving: t('Se salvează călătoria', 'Saving your trip'),
  };
  const states: Record<GPSSignal, string> = {
    off: t('GPS oprit', 'GPS off'), requesting: t('Se solicită permisiunea', 'Requesting permission'), searching: t('Se caută semnal GPS', 'Finding GPS signal'),
    connected: t('GPS conectat', 'GPS connected'), weak: t('Precizie slabă · distanță în așteptare', 'Low accuracy · distance paused'),
    stale: t('Semnal GPS pierdut', 'GPS signal lost'), error: t('GPS indisponibil', 'GPS unavailable'),
  };
  return <div className={'drive-session drive-session--' + phase} data-workspace-ui>
    <div className="drive-session-status" role="status"><span className="drive-session-dot"/>{labels[phase]}</div>
    <div className="drive-session-distance"><span>{measured ? metric.value : '—'}</span>{measured && <small>{metric.unit}</small>}</div>
    <p className="drive-session-caption">{measured ? t('Distanță înregistrată · estimare GPS', 'Recorded distance · GPS estimate') : t('Pornește o călătorie pentru a înregistra distanța.', 'Start a drive to record distance.')}</p>
    <div className="drive-session-details">
      <div><Clock3 size={18}/><span>{t('Durată călătorie', 'Trip duration')}</span><strong>{measured ? driveDuration(seconds) : '—'}</strong></div>
      <div><Gauge size={18}/><span>{t('Viteză actuală', 'Current speed')}</span><strong>{speed === null ? '—' : speed + ' km/h'}</strong></div>
      <div><MapPin size={18}/><span>{t('Precizie GPS', 'GPS accuracy')}</span><strong>{accuracy === null ? '—' : '± ' + Math.round(accuracy) + ' m'}</strong></div>
      <div className="drive-signal" data-signal={signal}><Radio size={18}/><span>{t('Conexiune', 'Connection')}</span><strong>{states[signal]}</strong></div>
    </div>
    <p className="drive-session-privacy"><Route size={14}/>{t('Doar punctele GPS valide sunt adăugate traseului.', 'Only valid GPS fixes contribute to your route.')}</p>
  </div>;
}
