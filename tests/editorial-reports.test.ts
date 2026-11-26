import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { buildReportAnalysis, reportPeriod, type ReportRecord } from '../src/lib/report-analysis';
import { A4 } from '../src/lib/report-layout';
import { vehicleReport } from '../src/lib/vehicle-report';
import { mileageReport } from '../src/lib/mileage-report';
import { mileageSeries } from '../src/lib/mileage-history';

const vehicle={id:'v',brand:'Škoda',model:'Octavia',plate:'CJ 10 TEST',odometer:40000};
const record:ReportRecord={id:'r',vehicleId:vehicle.id,date:'2026-11-10',kind:'expense',title:'Cheltuială',category:'Parcare',amountBani:59500,
  amountKnown:true,expiresAt:null,nextKm:null,odometer:null,provider:null,notes:null,parts:null};
const reads=[{id:'1',vehicleId:'v',odometer:39000,recordedAt:'2026-11-03T10:00:00Z',createdAt:'2026-11-03T10:00:00Z',source:'manual'},
  {id:'2',vehicleId:'v',odometer:40000,recordedAt:'2026-11-12T10:00:00Z',createdAt:'2026-11-12T10:00:00Z',source:'gps'}];

test('report ranges include leap months and calculate recorded costs and per-km values without unknown, future or duplicate expenses',()=>{
  assert.deepEqual(reportPeriod('previous','2024-03-13'), {from:'2024-02-01',to:'2024-02-29'});
  assert.deepEqual(reportPeriod('12','2026-11-26'), {from:'2025-12-01',to:'2026-11-26'});
  const result=buildReportAnalysis([record,record,{...record,id:'x',amountKnown:false},{...record,id:'y',cancelled:true},
    {...record,id:'s',kind:'service',date:'2026-12-03',parts:'AutoCare · planned: 1'}],[vehicle],reads,'2026-11-26','Europe/Bucharest','2026-09-01','2026-12-31');
  assert.equal(result.finance.total,59500);
  assert.deepEqual(result.monthKeys,['2026-09','2026-10','2026-11']);
  assert.equal(result.months.get('2026-10'),undefined);
  assert.equal(result.distance,1000);
  assert.equal(result.costPerKm,59.5);
  assert.equal(result.planned.length,1);
  const withoutDistance=buildReportAnalysis([record],[vehicle],reads.slice(0,1),'2026-11-26','Europe/Bucharest');
  assert.equal(withoutDistance.costPerKm,null);
});

test('annual and mileage documents are A4; empty data stays on one page and a large ledger is paginated',async()=>{
  const opts={generatedAt:'26.11.2026',asOf:'2026-11-26'};
  const empty=await PDFDocument.load(await vehicleReport({...opts,variant:'annual',vehicles:[],records:[]}));
  assert.equal(empty.getPageCount(),1);
  const long=await PDFDocument.load(await vehicleReport({...opts,variant:'finance',vehicles:[vehicle],records:Array.from({length:250},(_,i)=>({...record,id:String(i)}))}));
  assert.ok(long.getPageCount()>7);
  const mileage=await PDFDocument.load(await mileageReport(vehicle,mileageSeries(reads,'Europe/Bucharest'),'Europe/Bucharest','','',true));
  assert.match(mileage.getTitle()??'',/Mileage/);
  for(const pdf of [empty,long,mileage])for(const p of pdf.getPages())assert.deepEqual(p.getSize(),{width:A4.width,height:A4.height});
});
