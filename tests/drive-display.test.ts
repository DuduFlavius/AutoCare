import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driveDistance,driveDuration} from '../src/lib/drive-display';
test('trip units switch cleanly from metres to kilometres and duration retains seconds',()=>{
 assert.deepEqual(driveDistance(0),{value:'0',unit:'m',meters:0});
 assert.equal(driveDistance(999).unit,'m');assert.equal(driveDistance(999.6).unit,'km');
 assert.equal(driveDistance(1234,'en-GB').value,'1.23');
 assert.equal(driveDuration(3599),'00:59:59');assert.equal(driveDuration(3600),'01:00:00');
 assert.equal(driveDuration(-5),'00:00:00');assert.equal(driveDistance(Number.NaN).meters,0);
});
