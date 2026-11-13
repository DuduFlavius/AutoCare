import { isPlannedService } from './planned-service';

export function summarize(
  rows: Array<{
    amountBani: number;
    category: string;
    date: string | null;
    odometer: number | null;
    vehicleId: string;
  }>,
  year: number,
  month: string,
) {
  const selected = rows.filter((r) => r.date?.startsWith(String(year)));
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    bani: 0,
  }));
  const categories: Record<string, number> = {};
  for (const r of selected) {
    const m = Number(r.date!.slice(5, 7)) - 1;
    monthly[m].bani += r.amountBani;
    categories[r.category] = (categories[r.category] || 0) + r.amountBani;
  }
  const mileage = new Map<string, number[]>();
  for (const r of [...selected].sort((a,b)=>(a.date||'').localeCompare(b.date||'')))
    if (r.odometer != null) {
      const a = mileage.get(r.vehicleId) || [];
      a.push(r.odometer);
      mileage.set(r.vehicleId, a);
    }
  let km = 0;
  let mileageComplete=true;
  for(const id of new Set(selected.filter(r=>r.amountBani>0).map(r=>r.vehicleId))){const values=mileage.get(id)||[];if(values.length<2||values.some((value,index)=>index>0&&value<values[index-1])||values[values.length-1]<=values[0])mileageComplete=false;}
  for (const a of mileage.values()) if (a.length >= 2) km += Math.max(...a) - Math.min(...a);
  const annualBani = selected.reduce((a, r) => a + r.amountBani, 0);
  return {
    annualBani,
    monthBani: selected
      .filter((r) => r.date?.startsWith(month))
      .reduce((a, r) => a + r.amountBani, 0),
    monthly,
    categories,
    costPerKm: mileageComplete && km > 0 ? annualBani / 100 / km : null,
    km,
  };
}
export const financeGroups = ['Combustibil', 'Service', 'Frâne', 'RCA', 'ITP', 'Anvelope', 'Distribuție', 'Alte cheltuieli'] as const;
export type FinanceGroup = typeof financeGroups[number];
export type FinanceEntry = {
  id: string; vehicleId: string; kind: string; date: string | null; title: string; category: string;
  cancelled: boolean; amountBani: number; amountKnown?: boolean; odometer: number | null;
  provider?: string | null; parts?: string | null; createdAt?: string | Date;
};

export function financeGroup(row: Pick<FinanceEntry, 'category' | 'kind'>): FinanceGroup {
  const label = row.category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/combustibil|alimentare|carburant/.test(label)) return 'Combustibil';
  if (/fran/.test(label)) return 'Frâne';
  if (/^rca\b/.test(label)) return 'RCA';
  if (/^itp\b/.test(label)) return 'ITP';
  if (/anvelop|vulcaniz/.test(label)) return 'Anvelope';
  if (/distribut/.test(label)) return 'Distribuție';
  return row.kind === 'service' || /service|revizi|repara/.test(label) ? 'Service' : 'Alte cheltuieli';
}

export function isFinancialEntry(row: FinanceEntry, today: string) {
  return !isPlannedService(row, today) && (row.kind === 'expense' || (row.amountKnown !== false && row.amountBani > 0));
}

export function financialChange(current: number, previous: number) {
  return previous > 0 ? (current - previous) / previous * 100 : null;
}

export function financeOverview<T extends FinanceEntry>(rows: T[], today: string, vehicleId = '') {
  const month = today.slice(0, 7);
  const year = Number(today.slice(0, 4));
  const [y, m] = month.split('-').map(Number);
  const previousMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const uniqueRows = [...new Map(rows.map(row => [row.id, row])).values()];
  const entries = uniqueRows.filter(row => (!vehicleId || row.vehicleId === vehicleId) && isFinancialEntry(row, today));
  const dated = entries.filter(row => !row.cancelled && row.date && row.date <= today);
  const known = dated.filter(row => row.amountKnown !== false);
  const sum = (values: FinanceEntry[]) => values.reduce((total, row) => total + row.amountBani, 0);
  const monthly = known.filter(row => row.date!.startsWith(month));
  const previous = known.filter(row => row.date!.startsWith(previousMonth));
  const annual = known.filter(row => row.date!.startsWith(String(year)));
  const previousYear = known.filter(row => row.date!.startsWith(String(year - 1)));
  // Preserve the existing cost/km formula and include genuine mileage evidence from zero-cost service records.
  const mileageInputs = uniqueRows.filter(row => !row.cancelled && row.date && row.date <= today &&
    !isPlannedService(row, today) && (!vehicleId || row.vehicleId === vehicleId));
  const mileage = summarize(mileageInputs.map(row => ({ ...row, amountBani: isFinancialEntry(row, today) && row.amountKnown !== false ? row.amountBani : 0 })), year, month);
  const series = Array.from({ length: 12 }, (_, index) => {
    const suffix = '-' + String(index + 1).padStart(2, '0');
    const current = dated.filter(row => row.date!.startsWith(year + suffix));
    const last = dated.filter(row => row.date!.startsWith((year - 1) + suffix));
    const measured = (items: FinanceEntry[]) => {
      const values = items.filter(row => row.amountKnown !== false);
      return { count: items.length, known: values.length, bani: sum(values) };
    };
    return { month: year + suffix, current: measured(current), previous: measured(last) };
  });
  const categories = (period: 'month' | 'year') => {
    const [current, prior] = period === 'month' ? [monthly, previous] : [annual, previousYear];
    const total = sum(current);
    return financeGroups.map(group => {
      const bani = sum(current.filter(row => financeGroup(row) === group));
      const previousBani = sum(prior.filter(row => financeGroup(row) === group));
      return { group, bani, previousBani, share: total ? bani / total * 100 : 0, change: financialChange(bani, previousBani) };
    });
  };
  return {
    entries, series, categories, monthKnown: monthly.length, yearKnown: annual.length, previousMonthKnown: previous.length, previousYearKnown: previousYear.length, monthBani: sum(monthly), previousMonthBani: sum(previous),
    yearBani: sum(annual), previousYearBani: sum(previousYear), costPerKm: mileage.costPerKm,
    km: mileage.km, monthCount: dated.filter(row => row.date!.startsWith(month)).length,
    previousMonthCount: dated.filter(row => row.date!.startsWith(previousMonth)).length,
    yearCount: dated.filter(row => row.date!.startsWith(String(year))).length,
    previousYearCount: dated.filter(row => row.date!.startsWith(String(year - 1))).length,
  };
}

export function budgetState(limitBani: number, usedBani: number) {
  const percent = limitBani > 0 ? usedBani / limitBani * 100 : 0;
  return { remaining: limitBani - usedBani, percent, threshold: percent >= 100 ? 100 : percent >= 90 ? 90 : percent >= 70 ? 70 : 0 };
}

export const financeBudgetKey = (userId: string) => 'finance-budgets:' + userId;

/** Conservative signals from completed months with recorded costs; missing months are not assumed free. */
export function financeSignals(rows: FinanceEntry[], today: string, vehicleId = '') {
  const entries = financeOverview(rows,today,vehicleId).entries.filter(row=>!row.cancelled&&row.amountKnown!==false&&row.date&&row.date<=today);
  const months = new Map<string,number>();
  for(const row of entries) if(row.date!.slice(0,7)<today.slice(0,7)) {
    const key=row.date!.slice(0,7); months.set(key,(months.get(key)||0)+row.amountBani);
  }
  const recent=[...months.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);
  const forecastBani=recent.length>=3 ? Math.round(recent.reduce((sum,[,bani])=>sum+bani,0)/recent.length) : null;
  const amounts=entries.filter(row=>row.date!.startsWith(today.slice(0,4))&&row.amountBani>0).map(row=>row.amountBani).sort((a,b)=>a-b);
  const median=amounts.length ? (amounts[Math.floor((amounts.length-1)/2)]+amounts[Math.floor(amounts.length/2)])/2 : 0;
  const unusual=amounts.length>=5&&median>0 ? entries.filter(row=>row.date!.startsWith(today.slice(0,4))&&row.amountBani>=3*median) : [];
  return {forecastBani, measuredMonths:recent.length, unusual};
}
