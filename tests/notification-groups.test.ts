import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupedNotifications} from '../src/lib/notification-groups';
const n={id:'1',userId:'owner',recordId:'rca',revision:1,offset:'7',localDate:'2030-01-01',channel:'email',readAt:null as Date|null,status:'accepted'};
test('one inbox item represents an alert across app, email and push while preserving distinct reminders',()=>{
 const result=groupedNotifications([n,{...n,id:'2',channel:'push'},{...n,id:'3',channel:'app',status:'delivered'},{...n,id:'4',recordId:'itp'},{...n,id:'5',offset:'1'}]);
 assert.equal(result.length,3);assert.equal(result[0].id,'3');
});
test('dismissed app reminders hide their transport copies but leave a revised reminder visible',()=>{
 const input=[n,{...n,id:'2',channel:'app',status:'dismissed'}];
 assert.equal(groupedNotifications(input).length,0);assert.equal(input[0].status,'accepted');
 assert.equal(groupedNotifications([...input,{...n,revision:2}]).length,1);
});
