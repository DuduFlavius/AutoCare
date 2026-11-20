import test from 'node:test';
import assert from 'node:assert/strict';
import {ConfirmationQueue,type ConfirmationRequest} from '../src/lib/confirmation-queue';
test('confirmation fails closed before the UI host is mounted',async()=>{assert.equal(await new ConfirmationQueue().request('Delete?','en'),false);});
test('cancel and repeated clicks never authorize an operation',async()=>{
 const q=new ConfirmationQueue(),events:(ConfirmationRequest|null)[]=[];const off=q.subscribe(value=>events.push(value));
 const first=q.request('Delete document?','en');assert.equal(await q.request('Delete document?','en'),false);
 assert.equal(events.length,1);q.settle(false);assert.equal(await first,false);assert.equal(events.at(-1),null);off();
});
test('confirm resolves once and the next decision receives its own language',async()=>{
 const q=new ConfirmationQueue();let current:ConfirmationRequest|null=null;const off=q.subscribe(value=>{current=value;});
 const first=q.request('Ștergi?','ro');assert.equal((current as ConfirmationRequest|null)?.language,'ro');q.settle(true);q.settle(false);assert.equal(await first,true);
 const next=q.request('Delete?','en');assert.equal((current as ConfirmationRequest|null)?.language,'en');q.settle(false);assert.equal(await next,false);off();
});
test('unmounting the last host cancels outstanding work rather than leaving it authorized',async()=>{
 const q=new ConfirmationQueue(),off=q.subscribe(()=>{});let performed=0;
 const pending=q.request('Delete?','en',async()=>{performed++;});off();assert.equal(await pending,false);assert.equal(performed,0);
});
