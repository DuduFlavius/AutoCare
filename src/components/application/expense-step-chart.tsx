'use client';
import { useMemo, useState } from 'react';
import { cumulativeAt, type expenseSelection } from '@/lib/finance-selection';

const width = 680;
const left = 2;
const right = 678;
const top = 8;
const baseline = 152;
const xAt = (fraction: number) => left + (right - left) * fraction;
type Selection = ReturnType<typeof expenseSelection>;

export function ExpenseStepChart({ selection, en, locale, money }: {
  selection: Selection; en: boolean; locale: string; money: (bani: number) => string;
}) {
  const { start, end, changes, total } = selection;
  const [selected, setSelected] = useState<number | null>(null);
  const day = selected == null ? end : Math.min(end, Math.max(start, selected));
  const t = (ro: string, english: string) => en ? english : ro;
  const span = Math.max(1, end - start);
  const fraction = (at: number) => start === end ? .5 : (at - start) / span;
  const max = Math.max(1, total);
  const y = (bani: number) => baseline - bani / max * (baseline - top);
  const line = useMemo(() => `M ${left} ${baseline}` + changes.map(change => {
    const position=start===end?.5:(change.day-start)/Math.max(1,end-start);
    return ` H ${xAt(position)} V ${baseline-change.total/Math.max(1,total)*(baseline-top)}`;
  }).join('') + ` H ${right}`,[changes,start,end,total]);
  const point = cumulativeAt(changes, day);
  const formatter=useMemo(()=>new Intl.DateTimeFormat(locale,{ day:'numeric',month:'short',
    ...(end-start>365?{year:'numeric' as const}:{}),timeZone:'UTC'}),[locale,start,end]);
  const label = (at: number) => formatter.format(new Date(at * 86400000));
  const dates = [...new Set([start, Math.round((start + end) / 2), end])];
  return <div className="ac-step-chart">
    <div className="ac-step-grid" aria-hidden="true">
      {[1,.5,0].map(level => <span key={level}>{money(Math.round(total * level))}</span>)}
    </div>
    <div className="ac-step-plot">
      <svg viewBox={`0 0 ${width} 160`} preserveAspectRatio="none" aria-hidden="true"
        onPointerMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.pointerType !== 'touch') setSelected(start + Math.round(span * Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))));
        }}
        onPointerDown={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          setSelected(start + Math.round(span * Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))));
        }}>
        {[1,.5,0].map(level => <line key={level} x1={left} x2={right} y1={y(max * level)} y2={y(max * level)}/>)}
        <path d={`${line} V ${baseline} H ${left} Z`} className="ac-step-fill"/>
        <path d={line} className="ac-step-line" vectorEffect="non-scaling-stroke"/>
        <line className="ac-step-cursor" x1={xAt(fraction(day))} x2={xAt(fraction(day))} y1={top} y2={baseline} vectorEffect="non-scaling-stroke"/>
      </svg>
      <div className="ac-step-dates" aria-hidden="true">{dates.map(date => <span key={date}>{label(date)}</span>)}</div>
      {end > start && <input className="sr-only ac-step-control" type="range" min={start} max={end} value={day}
        onChange={event => setSelected(Number(event.target.value))} aria-label={t('Alege ziua din grafic', 'Choose chart date')}
        aria-valuetext={label(day) + ' · ' + money(point.total)}/>}
    </div>
    <dl className="ac-step-tooltip">
      <div><dt>{t('Data', 'Date')}</dt><dd>{label(day)}</dd></div>
      <div><dt>{t('Cheltuieli în ziua selectată', 'Expenses on selected day')}</dt><dd>{money(point.amount)}</dd></div>
      <div><dt>{t('Total cumulativ', 'Cumulative total')}</dt><dd>{money(point.total)}</dd></div>
    </dl>
  </div>;
}
