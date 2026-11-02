'use client';
import { Droplets, Settings2, ArrowUpRight } from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { currentHomeMaintenance, isOilMaintenance, upcomingMaintenance } from '@/lib/application-home';
import { forecastDuration } from '@/lib/service-forecast';
import type { dashboard } from '@/lib/service';
type RecordItem = Awaited<ReturnType<typeof dashboard>>['records'][number];
export default function MaintenanceHighlights({ rows, currentKm, dailyKm, timezone, premium, onRecord, onCreate }: { rows: RecordItem[]; currentKm: number; dailyKm: number | null; timezone: string; premium: boolean; onRecord: (r: RecordItem) => void; onCreate: () => void }) {
  const language = useApplicationLanguage(), en = language === 'en', locale = useApplicationLocale();
  const latest = currentHomeMaintenance(rows);
  const sections = [{ id:'oil',ro:'Schimb de ulei',en:'Oil change',Icon:Droplets,record:latest.find(isOilMaintenance) },...(premium ? [{id:'timing',ro:'Distribuție',en:'Timing service',Icon:Settings2,record:latest.find(r=>r.category==='Distribuție')}] : [])];
  return <div className="app-maintenance-highlights" data-workspace-ui>{sections.map(s=>{
    const result = s.record ? upcomingMaintenance([s.record],currentKm,dailyKm,timezone)[0] : undefined;
    const km = result?.status.remainingKm;
    return <button type="button" key={s.id} onClick={()=>s.record ? onRecord(s.record) : onCreate()}><span className="app-highlight-icon"><s.Icon size={22}/></span><span className="app-highlight-description"><strong>{s[language]}</strong><small>{result ? forecastDuration(result.estimate?.days ?? null,language) : en?'Set a service interval':'Configurează intervalul de schimb'}</small></span><span className="app-highlight-distance">{km != null ? <><strong>{Math.abs(km).toLocaleString(locale)} km</strong><small>{km<0 ? (en?'overdue':'peste prag') : (en?'remaining':'rămași')}</small></> : <ArrowUpRight size={18}/>}</span></button>;
  })}</div>;
}
