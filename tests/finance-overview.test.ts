import assert from 'node:assert/strict';
import { test } from 'node:test';
import { budgetState, financeSignals, financeOverview, type FinanceEntry } from '../src/lib/finance-overview';
import { calendarRecordDate, isPlannedService } from '../src/lib/planned-service';

const row = (id: string, patch: Partial<FinanceEntry>): FinanceEntry => ({
  id, kind: 'expense', vehicleId: 'car', title: id, category: 'Alimentare',
  date: '2026-02-01', amountBani: 0, amountKnown: true, odometer: null, cancelled: false, ...patch,
});

test('finance counts each source once and separates zero, missing and unknown costs', () => {
  const report = financeOverview([
    row('actual-zero', { odometer: 1000 }),
    row('oil', { kind: 'service', date: '2026-03-01', category: 'Schimb ulei', amountBani: 5000, odometer: 1100 }),
    row('rca', { kind: 'document', date: '2026-03-02', category: 'RCA', amountBani: 6000 }),
    row('unpriced', { date: '2026-04-01', amountKnown: false }),
    row('plan', { kind: 'service', parts: 'AutoCare · planned: 1', amountBani: 8000 }),
    row('archived', { cancelled: true, amountBani: 4000 }),
    row('other-car', { vehicleId: 'other', amountBani: 6000 }),
  ], '2026-04-10', 'car');
  assert.equal(report.yearBani, 11000);
  assert.equal(report.costPerKm, 1.1);
  assert.deepEqual(report.series.slice(0, 4).map(value => value.current), [
    { count: 0, known: 0, bani: 0 }, { count: 1, known: 1, bani: 0 },
    { count: 2, known: 2, bani: 11000 }, { count: 1, known: 0, bani: 0 },
  ]);
  assert.equal(report.categories('year').find(category => category.group === 'RCA')?.bani, 6000);
  assert.deepEqual([6999, 7000, 9000, 10000, 10100].map(value => budgetState(10000, value).threshold), [0, 70, 90, 100, 100]);
});

test('planned service remains a calendar item until it is completed', () => {
  const planned = { ...row('scheduled-oil', { kind: 'service', date: '2026-05-08', parts: 'AutoCare · planned: 1' }), expiresAt: '2027-05-08' };
  assert.equal(isPlannedService(planned, '2026-05-15'), true);
  assert.equal(calendarRecordDate(planned, '2026-05-15'), '2026-05-08');
  assert.equal(calendarRecordDate({ ...planned, parts: planned.parts + '\nAutoCare · completedBy: 123' }, '2026-05-15'), null);
  assert.equal(isPlannedService({ ...planned, parts: null, createdAt: '2026-05-01T12:00:00Z' }, '2026-05-15'), true);
});

test('financial totals reconcile by period, category and chart, with repeated IDs counted once',()=>{
 const input=[row('a',{amountBani:10001}),row('b',{date:'2026-03-01',category:'RCA',kind:'document',amountBani:23000}),row('a',{amountBani:10001}),row('old',{date:'2025-01-01',amountBani:500}),row('future',{date:'2026-12-01',amountBani:999}),row('archived',{cancelled:true,amountBani:300}),row('unknown',{amountKnown:false,amountBani:9000})];
 const report=financeOverview(input,'2026-04-10');
 assert.equal(report.yearBani,33001);
 assert.equal(report.categories('year').reduce((n,r)=>n+r.bani,0),report.yearBani);
 assert.equal(report.series.reduce((n,r)=>n+r.current.bani,0),report.yearBani);
 assert.equal(report.series.reduce((n,r)=>n+r.previous.bani,0),report.previousYearBani);
});
test('finance estimates need three completed recorded months and identify only supported outliers',()=>{
 const input=[row('a',{date:'2026-01-01',amountBani:10000}),row('b',{date:'2026-02-01',amountBani:10000}),row('c',{date:'2026-03-01',amountBani:10000}),row('d',{date:'2026-04-01',amountBani:10000}),row('e',{date:'2026-04-02',amountBani:60000})];
 assert.equal(financeSignals(input,'2026-03-15').forecastBani,null);
 const signals=financeSignals(input,'2026-04-10');
 assert.equal(signals.forecastBani,10000);assert.equal(signals.measuredMonths,3);assert.deepEqual(signals.unusual.map(row=>row.id),['e']);
 assert.equal(financeSignals(input,'2026-04-10','other').forecastBani,null);
});
