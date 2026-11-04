import {test} from 'node:test';
import assert from 'node:assert/strict';
import {automaticTripBatch} from '../src/lib/automatic-trips';
const row={id:'34b0e891-3488-49c1-8775-796dbd60f68c',distanceMeters:2000,durationSeconds:600,startedAt:'2026-01-01T10:00:00.000Z',endedAt:'2026-01-01T10:10:00.000Z'};
test('automatic trip batches reject duplicates, impossible speed and inconsistent clocks',()=>{for(const input of [{expectedOdometer:1000,trips:[row,row]},{expectedOdometer:1000,trips:[{...row,distanceMeters:50000}]},{expectedOdometer:1000,trips:[{...row,endedAt:'2026-01-01T09:00:00.000Z'}]},{expectedOdometer:-1,trips:[row]}])assert.equal(automaticTripBatch.safeParse(input).success,false);assert.equal(automaticTripBatch.parse({expectedOdometer:1000,trips:[row]}).syncMileage,true);});
