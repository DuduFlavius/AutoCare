import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportOverview } from '../src/components/application/report-overview';
import type { FinanceEntry } from '../src/lib/finance-overview';
test('report summary uses real completed costs without duplicates, unknown costs, archived or future work',()=>{
 const base:FinanceEntry={id:'expense',vehicleId:'car',kind:'expense',title:'Cost',category:'Alte cheltuieli',date:'2026-11-10',cancelled:false,amountBani:10000,amountKnown:true,odometer:null};
 const rows=[base,base,{...base,id:'service',kind:'service',amountBani:25000},{...base,id:'unknown',amountKnown:false,amountBani:99900},{...base,id:'future',kind:'service',date:'2026-12-20',amountBani:80000},{...base,id:'archived',cancelled:true,amountBani:90000}];
 const html=renderToStaticMarkup(createElement(ReportOverview,{rows,vehicleCount:1,today:'2026-11-19',en:false}));
 assert.match(html,/350,00/);assert.doesNotMatch(html,/999,00|800,00|900,00/);
 assert.match(html,/Intervenții înregistrate<\/span><strong>1<\/strong>/);
 assert.match(html,/Vehicule incluse<\/span><strong>1<\/strong>/);
});
test('report chart, category totals and service count share the selected twelve-month window',()=>{
 const base:FinanceEntry={id:'current',vehicleId:'car',kind:'service',title:'Current service',category:'Current category',date:'2026-11-01',cancelled:false,amountBani:12300,amountKnown:true,odometer:1000};
 const html=renderToStaticMarkup(createElement(ReportOverview,{rows:[base,{...base,id:'old',category:'Outside period',date:'2024-01-01',amountBani:900000}],vehicleCount:1,today:'2026-11-19',en:false}));
 assert.match(html,/123,00/);assert.doesNotMatch(html,/Outside period|9\.000,00/);assert.match(html,/Intervenții înregistrate<\/span><strong>1<\/strong>/);
});
