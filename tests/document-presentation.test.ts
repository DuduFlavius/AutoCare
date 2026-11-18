import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentFitSize,documentDownloadName,documentDisposition,calendarCells,attachmentError} from '../src/lib/document-presentation';
test('ITP, RCA, CASCO and vignette download names preserve the vehicle and actual issue/expiry dates',()=>{
 for(const category of ['ITP','RCA','CASCO','Rovinietă']){
  const name=documentDownloadName({category,date:'2026-11-17',expiresAt:'2027-11-17'},{plate:'TM52RVX'},'application/pdf');
  assert.equal(name,`TM52RVX ${category} emis 17.11.2026 expira 17.11.2027.pdf`);
  assert.match(documentDisposition(name),/^attachment;/);assert.match(documentDisposition(name,true),/^inline;/);
 }
 const unknown=documentDownloadName({category:'ITP',date:null,expiresAt:null},{plate:'B123ABC'},'image/jpeg');assert.equal(unknown,'B123ABC ITP.jpg');assert.doesNotMatch(unknown,/emis|expira/);
 assert.doesNotMatch(documentDisposition(documentDownloadName({category:'RCA\r\nX: injected',date:null,expiresAt:null},{plate:'../TM1'},'image/png')),/[\r\n]/);
});
test('calendar grid starts on Monday, handles leap day and December/January without shifting dates',()=>{
 const leap=calendarCells(2028,1);assert.equal(leap.length,42);assert.equal(leap[0].iso,'2028-01-31');assert.ok(leap.some(cell=>cell.iso==='2028-02-29'&&!cell.outside));
 const january=calendarCells(2027,0);assert.equal(january[0].iso,'2026-12-28');assert.equal(january[4].iso,'2027-01-01');assert.equal(new Set(january.map(cell=>cell.iso)).size,42);
});
test('attachment selection rejects empty, oversized or unsupported files without accepting an executable',()=>{
 assert.ok(attachmentError({name:'a.pdf',size:0,type:'application/pdf'}));assert.ok(attachmentError({name:'a.pdf',size:2097153,type:'application/pdf'}));assert.ok(attachmentError({name:'a.exe',size:100,type:'application/octet-stream'}));
 assert.equal(attachmentError({name:'a.pdf',size:200,type:'application/octet-stream'}),'');assert.equal(attachmentError({name:'a.png',size:200,type:'image/png'}),'');
});

test('portrait screenshots and PDF pages fit both viewport dimensions; explicit zoom preserves aspect ratio',()=>{
 const portrait=documentFitSize(945,2048,1000,650);assert.ok(portrait.height<=650);assert.ok(portrait.width<400);
 const mobile=documentFitSize(945,2048,330,500);assert.ok(mobile.height<=500);assert.ok(mobile.width<=330);
 const width=documentFitSize(945,2048,330,500,1,'width');assert.equal(width.width,330);assert.ok(width.height>500);
 const zoom=documentFitSize(945,2048,330,500,2);assert.ok(Math.abs(zoom.height/mobile.height-2)<.01);
 assert.equal(documentFitSize(100,100,500,500).width,100);assert.ok(Number.isFinite(documentFitSize(NaN,0,0,NaN).width));
});
