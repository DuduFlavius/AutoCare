import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastService } from '../src/lib/service-forecast';
const today = new Date('2026-10-29T12:00:00Z');
test('forecasts using confirmed daily mileage',()=>{assert.deepEqual(forecastService({currentKm:95000,nextKm:100000,averageKmPerDay:100,today}),{remainingKm:5000,days:50,estimatedDate:'2026-12-18',basis:'odometer'});});
test('earliest of time or mileage is used',()=>{const x=forecastService({currentKm:95000,nextKm:100000,averageKmPerDay:100,dueDate:'2026-11-08',today});assert.equal(x?.days,10);assert.equal(x?.basis,'both');});
test('does not invent a date without usage history',()=>{const x=forecastService({currentKm:95000,nextKm:100000,today});assert.equal(x?.days,null);assert.equal(x?.estimatedDate,null);assert.equal(x?.remainingKm,5000);});
test('already due means zero remaining',()=>{const x=forecastService({currentKm:101000,nextKm:100000,today});assert.equal(x?.days,0);assert.equal(x?.remainingKm,0);});
test('rejects invalid odometers',()=>{assert.equal(forecastService({currentKm:-1,nextKm:1000}),null);});
