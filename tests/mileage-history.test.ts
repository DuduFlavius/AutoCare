import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mileageSeries,type MileageReading} from '../src/lib/mileage-history';

const reading=(id:string,date:string,odometer:number,source='manual'):MileageReading=>({
  id,recordedAt:date,createdAt:date,odometer,source,
});
const entries=[
  reading('2','2026-11-22T15:00:00Z',90003,'gps'),
  reading('1','2026-11-22T07:00:00Z',90001,'gps'),
  reading('0','2026-11-12T07:00:00Z',80000),
];
test('sorts actual readings chronologically and uses elapsed local calendar days for the average',()=>{
  const series=mileageSeries(entries,'Europe/Bucharest');
  assert.deepEqual(series.rows.map(row=>row.delta),[null,10001,2]);
  assert.equal(series.distance,10003);
  assert.equal(series.average,1000.3);
  const day=mileageSeries(entries,'Europe/Bucharest','2026-11-22','2026-11-22');
  assert.equal(day.distance,2);
  assert.equal(day.average,null);
});
test('single and empty selections never synthesize distance or speed',()=>{
  assert.equal(mileageSeries(entries.slice(0,1),'UTC').distance,null);
  assert.equal(mileageSeries(entries,'UTC','2027-01-01').rows.length,0);
});
