import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { localDate } from './config';
import { financeGroup, isFinancialEntry } from './finance-overview';
import { calendarRecordDate } from './planned-service';
import type { TemplateInput } from './email-templates';

function shiftMonth(month: string, delta: number) {
  const date = new Date(month + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0,7);
}
export function previousReportMonth(now: Date, timezone: string) {
  return shiftMonth(localDate(now, timezone).slice(0,7), -1);
}

export async function monthlyVehicleReport(uid: string, month: string, language: 'ro'|'en', now: Date): Promise<TemplateInput|null> {
  const [profile] = await db().select({ timezone:s.profiles.timezone }).from(s.profiles).where(eq(s.profiles.userId,uid));
  const zone = profile?.timezone ?? 'Europe/Bucharest';
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) || month !== previousReportMonth(now, zone)) return null;
  const en = language === 'en';
  const t = (ro: string, eng: string) => en ? eng : ro;
  const locale = en ? 'en-GB' : 'ro-RO';
  const today = localDate(now, zone);
  const before = shiftMonth(month,-1);
  const next = shiftMonth(month,1);
  const horizon = new Date(today+'T12:00:00Z');
  horizon.setUTCDate(horizon.getUTCDate()+30);
  const [records,trips] = await Promise.all([
    db().select({ record:s.records, odometer:s.vehicles.odometer }).from(s.records)
      .innerJoin(s.vehicles,and(eq(s.vehicles.id,s.records.vehicleId),eq(s.vehicles.userId,uid),eq(s.vehicles.archived,false)))
      .where(and(eq(s.records.userId,uid),eq(s.records.cancelled,false),sql`
        (${s.records.date} >= ${before+'-01'} AND ${s.records.date} < ${next+'-01'})
        OR ${s.records.kind} IN ('service','document')`)),
    db().select({ distance:sql<number>`coalesce(sum(${s.gpsTrips.distanceMeters}),0)::float8`, count:sql<number>`count(*)::int` })
      .from(s.gpsTrips)
      .innerJoin(s.vehicles,and(eq(s.vehicles.id,s.gpsTrips.vehicleId),eq(s.vehicles.userId,uid),eq(s.vehicles.archived,false)))
      .where(and(eq(s.gpsTrips.userId,uid),
        gte(sql`(${s.gpsTrips.startedAt} at time zone ${zone})::date`,month+'-01'),
        lt(sql`(${s.gpsTrips.startedAt} at time zone ${zone})::date`,next+'-01'))),
  ]);
  const financial = records.map(x=>x.record).filter(r=>r.amountKnown && isFinancialEntry(r,today));
  const current = financial.filter(r=>r.date?.startsWith(month+'-'));
  const previous = financial.filter(r=>r.date?.startsWith(before+'-'));
  const total = (rows: typeof current) => rows.reduce((sum,r)=>sum+r.amountBani,0);
  const money = (amount:number) => new Intl.NumberFormat(locale,{style:'currency',currency:'RON'}).format(amount/100);
  const soon = horizon.toISOString().slice(0,10);
  const upcoming = records.filter(({record,odometer})=>{
    const date = calendarRecordDate(record,today);
    const dueDate = date && date >= today && date <= soon;
    const dueDistance = record.kind === 'service' && record.nextKm !== null && record.nextKm >= odometer && record.nextKm-odometer <= 500;
    return dueDate || dueDistance;
  });
  const facts: NonNullable<TemplateInput['facts']> = [];
  if (current.length) facts.push({label:t('Cheltuieli înregistrate','Recorded expenses'),value:money(total(current))});
  const fuel = current.filter(r=>financeGroup(r)==='Combustibil');
  const service = current.filter(r=>r.kind==='service');
  if (fuel.length) facts.push({label:t('Combustibil','Fuel'),value:money(total(fuel))});
  if (service.length) facts.push({label:t('Întreținere','Maintenance'),value:money(total(service))});
  if (trips[0]?.count) {
    facts.push({label:t('Călătorii SmartDrive','SmartDrive trips'),value:String(trips[0].count)});
    facts.push({label:t('Distanță înregistrată','Recorded distance'),value:new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(trips[0].distance/1000)+' km'});
  }
  for (const [kind,label] of [['document',t('Documente care expiră în 30 de zile','Documents expiring in 30 days')],['service',t('Intervenții apropiate','Upcoming maintenance')]]) {
    const count = upcoming.filter(x=>x.record.kind===kind).length;
    if (count) facts.push({label,value:String(count)});
  }
  if (!facts.length) return null;
  const title = (period:string) => new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(period+'-01T12:00:00Z'));
  const trend = current.length && previous.length ? [before,month].map((period,i)=>{
    const amount = total(i ? current : previous);
    return {label:title(period),value:money(amount),width:amount*100/Math.max(1,total(current),total(previous))};
  }) : [];
  return {
    subject:t('AutoCare — Raport auto pentru ','AutoCare — Vehicle report for ')+title(month),
    message:upcoming.length ? t('Verifică în garaj termenele apropiate și actualizează-le după reînnoire sau revizie.','Check upcoming deadlines in your garage and update them after renewal or servicing.')
      : t('Datele din raport provin din înregistrările tale din AutoCare.','This report uses your saved AutoCare records.'),
    ctaPath:'/cont?tab=Rapoarte', facts, trend,
  };
}
