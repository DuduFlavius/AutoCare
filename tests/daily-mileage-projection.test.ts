import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyMileageProjection } from '../src/lib/daily-mileage-projection';
test('70 declared km accumulate by calendar day without advancing confirmed odometer or duplicating on refresh',()=>{
 const result=dailyMileageProjection(125000,70,'2026-11-13','2026-11-16');
 assert.deepEqual(result,{days:3,addedKm:210,projectedKm:125210,source:'declared-estimate'});
 assert.deepEqual(dailyMileageProjection(125000,70,'2026-11-13','2026-11-16'),result);
 assert.equal(dailyMileageProjection(125048,70,'2026-11-16','2026-11-16').addedKm,0);
});
test('invalid dates, future anchors and absent daily usage do not invent distance',()=>{
 for(const anchor of ['2026-02-30','invalid','2026-12-01'])assert.equal(dailyMileageProjection(100,70,anchor,'2026-11-16').addedKm,0);
 assert.equal(dailyMileageProjection(100,null,'2026-11-13','2026-11-16').projectedKm,100);
 assert.equal(dailyMileageProjection(99999990,70,'2026-11-13','2026-11-16').projectedKm,99999999);
});
