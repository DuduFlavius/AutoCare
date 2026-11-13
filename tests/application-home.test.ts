import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectActiveVehicle, upcomingMaintenance, isOilMaintenance, vehicleCareScore, homeCareAssessment } from '../src/lib/application-home';
import { mobileWorkspaceSections, workspaceSections } from '../src/lib/workspace';
const today = new Date('2030-01-01T12:00:00Z');
const service = { id:'oil',title:'Oil',category:'Schimb ulei',kind:'service',cancelled:false,date:'2029-12-01',odometer:100000,nextKm:115000,expiresAt:null,parts:null };
test('active vehicle selection never returns an archived or missing vehicle',()=>{
  const cars=[{id:'first',archived:false},{id:'second',archived:false},{id:'old',archived:true}];
  assert.equal(selectActiveVehicle(cars,'second')?.id,'second');
  assert.equal(selectActiveVehicle(cars,'old')?.id,'first');
  assert.equal(selectActiveVehicle(cars,'other-account')?.id,'first');
  assert.equal(selectActiveVehicle([{id:'old',archived:true}],'old'),null);
});
test('home maintenance uses shared calculations and confirmed daily usage',()=>{
  const result=upcomingMaintenance([service],108000,70,'UTC',today)[0];
  assert.equal(result.estimate?.remainingKm,7000);
  assert.equal(result.estimate?.days,100);
  assert.equal(upcomingMaintenance([service],110000,70,'UTC',today)[0].estimate?.days,72);
});
test('home prioritizes overdue work and does not invent deadlines',()=>{
  const result=upcomingMaintenance([service,{...service,id:'timing',category:'Distribuție',nextKm:105000},{...service,id:'no-plan',nextKm:null}],108000,null,'UTC',today);
  assert.equal(result[0].service.id,'timing');
  assert.equal(result[0].status.state,'overdue');
  assert.equal(result[1].estimate?.days,null);
  assert.equal(result.length,2);
  assert.equal(upcomingMaintenance([{...service,cancelled:true}],108000,70,'UTC',today).length,0);
});
test('mobile navigation has four clear destinations and retains secondary modules',()=>{
  assert.equal(mobileWorkspaceSections.length,4);
  assert.ok(mobileWorkspaceSections.some(s=>s.id==='Documente'));
  assert.ok(mobileWorkspaceSections.some(s=>s.id==='Cheltuieli'));
  assert.ok(mobileWorkspaceSections.some(s=>s.id==='Cont'));
  for(const section of mobileWorkspaceSections)assert.ok(workspaceSections.some(s=>s.id===section.id));
  for(const id of ['Notificări','Setări','Plan întreținere','Premium','Abonament','Centru de suport','Istoric auto','Cheltuieli','Calendar','Kilometraj'])assert.ok(workspaceSections.some(s=>s.id===id));
});

test('home retains legacy free oil tracking and retires older oil and timing forecasts only on Home',()=>{
  assert.equal(isOilMaintenance({...service,category:'Revizie',title:'Schimb de ulei și filtre'}),true);
  const newer={...service,id:'new-oil',date:'2030-01-01',odometer:110000,nextKm:125000};
  const results=upcomingMaintenance([service,newer],111000,70,'UTC',today);
  assert.equal(results.length,1);assert.equal(results[0].service.id,'new-oil');
  assert.equal(results[0].estimate?.remainingKm,14000);
});

test('a future planned source marked completed cannot hide its actual replacement on Home',()=>{
  const planned={...service,id:'old-plan',date:'2030-04-01',parts:'AutoCare · completedBy: actual'};
  const actual={...service,id:'actual',date:'2030-01-01',odometer:110000,nextKm:125000};
  const result=upcomingMaintenance([planned,actual],111000,70,'UTC',today);
  assert.equal(result.length,1);assert.equal(result[0].service.id,'actual');
});


test('saved legacy oil records remain visible with their own interval',()=>{
 for(const saved of [{...service,category:'Ulei',title:''},{...service,category:'Engine oil',title:'Service'},{...service,category:'Revizie',title:'Maintenance',nextKm:null,parts:'[ac:intervalUlei]: 15000'}]){
  assert.equal(isOilMaintenance(saved),true);
  assert.equal(upcomingMaintenance([saved],108000,70,'UTC',today)[0].status.remainingKm,7000);
 }
 assert.equal(isOilMaintenance({...service,category:'Cutie',title:'Schimb ulei cutie'}),false);
});

test('vehicle care score uses only dated documents and scheduled maintenance', () => {
  assert.deepEqual(vehicleCareScore([{ status: { days: null } }], [{ status: { state: 'unscheduled' } }]), {
    total: 0, valid: 0, percent: null,
  });
  assert.deepEqual(vehicleCareScore(
    [null, -1, 30, 31].map(days => ({ status: { days } })),
    ['unscheduled', 'overdue', 'valid'].map(state => ({ status: { state } })),
  ), { total: 5, valid: 2, percent: 40 });
});


test('home never presents a complete health percentage when core evidence is missing',()=>{
 const documents=[{category:'RCA',status:{days:120}},{category:'ITP',status:{days:200}}];
 const oil=[{service:{title:'Schimb ulei motor'},status:{state:'valid'}}];
 assert.equal(homeCareAssessment(documents,oil,84000).percent,100);
 assert.equal(homeCareAssessment(documents.slice(0,1),oil,84000).percent,null);
 assert.equal(homeCareAssessment(documents,[],84000).complete,false);
 assert.equal(homeCareAssessment(documents,oil,0).percent,null);
 assert.equal(homeCareAssessment(documents,[{...oil[0],status:{state:'overdue'}}],84000).percent,67);
 assert.equal(homeCareAssessment([{category:'ITP',status:{days:null}},documents[0]],oil,84000).percent,null);
});
