import type { FinanceEntry } from './finance-overview';

const dayMs = 86400000;
export const expenseDay = (value: string) => Date.parse(value) / dayMs;
export const expenseDate = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);

export function expenseSelection(rows: FinanceEntry[], today: string, from?: string) {
  const known = [...new Map(rows.map(row => [row.id, row])).values()]
    .filter(row => !row.cancelled && row.amountKnown !== false && row.date && row.date <= today && (!from || row.date >= from));
  const daily = new Map<string, number>();
  const categories = new Map<string, { name: string; bani: number; kind: string }>();
  for (const row of known) {
    daily.set(row.date!, (daily.get(row.date!) ?? 0) + row.amountBani);
    const category = categories.get(row.category);
    if (category) category.bani += row.amountBani;
    else categories.set(row.category, { name: row.category, bani: row.amountBani, kind: row.kind });
  }
  let total = 0;
  const changes = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => {
    total += amount;
    return { day: expenseDay(date), amount, total };
  });
  return {
    start: expenseDay(from ?? (changes[0] ? expenseDate(changes[0].day) : today)),
    end: expenseDay(today), changes, total, known,
    categories: [...categories.values()].sort((a, b) => b.bani - a.bani || a.name.localeCompare(b.name)),
  };
}

export function cumulativeAt(changes: ReturnType<typeof expenseSelection>['changes'], day: number) {
  let start = 0, end = changes.length;
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    if (changes[mid].day <= day) start = mid + 1;
    else end = mid;
  }
  const last = changes[start - 1];
  return { amount: last?.day === day ? last.amount : 0, total: last?.total ?? 0 };
}
