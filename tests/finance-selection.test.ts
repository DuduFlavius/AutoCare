import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseSelection, cumulativeAt, expenseDay } from '../src/lib/finance-selection';
import { formatDisplayMoney, parseEcbRate, validExchangeRate, currencyPreference } from '../src/lib/exchange-rate';
import type { FinanceEntry } from '../src/lib/finance-overview';

test('cumulative expenses stay flat across gaps and reconcile with real categories', () => {
  const base: FinanceEntry = {id:'a',vehicleId:'car',kind:'expense',date:'2026-11-02',title:'Fuel',category:'Combustibil',cancelled:false,amountBani:50001,odometer:null};
  const rows = [base, base, {...base,id:'b',amountBani:201}, {...base,id:'c',date:'2026-11-05',category:'Parcare',amountBani:799},
    {...base,id:'archive',cancelled:true}, {...base,id:'unknown',amountKnown:false}, {...base,id:'future',date:'2026-12-01'}];
  const selection = expenseSelection(rows,'2026-11-10','2026-11-01');
  assert.deepEqual(cumulativeAt(selection.changes,expenseDay('2026-11-01')),{amount:0,total:0});
  assert.deepEqual(cumulativeAt(selection.changes,expenseDay('2026-11-02')),{amount:50202,total:50202});
  assert.deepEqual(cumulativeAt(selection.changes,expenseDay('2026-11-04')),{amount:0,total:50202});
  assert.deepEqual(cumulativeAt(selection.changes,selection.end),{amount:0,total:51001});
  assert.equal(selection.categories.reduce((sum,item)=>sum+item.bani,0),selection.total);
  assert.equal(expenseSelection(rows.slice(0,3),'2026-11-10','2026-11-01').total,50202);
  assert.equal(expenseSelection(rows,'2026-11-10','2026-11-03').total,799);
  assert.equal(expenseSelection([],'2026-11-10').total,0);
});

test('ECB quote rounds converted totals once with an original-currency fallback', () => {
  const rate = parseEcbRate('<Cube time="2026-11-24"><Cube currency="RON" rate="5.3442"/></Cube>','2026-11-26');
  assert.deepEqual(rate,{date:'2026-11-24',ronPerEuro:'5.3442'});
  assert.equal(validExchangeRate(rate,'2026-12-02'),false);
  assert.equal(validExchangeRate({...rate,date:'2026-11-31'},'2026-12-02'),false);
  assert.equal(parseEcbRate('<Cube time="2026-11-24"><Cube currency="RON" rate="0.00"/></Cube>','2026-11-26'),null);
  assert.equal(formatDisplayMoney('en-GB','EUR',rate)(50000),'€93.56');
  assert.equal(formatDisplayMoney('en-GB','EUR',rate)(-50000),'-€93.56');
  assert.match(formatDisplayMoney('en-GB','EUR',null)(50000),/RON\s+500\.00/);
  assert.equal(currencyPreference('EUR'),'EUR');
  assert.equal(currencyPreference('USD'),'auto');
});
