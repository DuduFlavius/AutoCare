import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {translateApplicationCopy as t,normalizeCopy} from '../src/lib/application-language';
import {translationSource} from '../src/lib/workspace';

test('multiline JSX copy and accessible labels receive the same translations',()=>{
 assert.equal(t('Programează următoarea lucrare după dată sau kilometraj, conform\n   planului mașinii tale.','en'),"Schedule the next maintenance by date or mileage, following your vehicle's maintenance plan.");
 assert.equal(t('Kilometri pe zi pentru estimare','en'),'Daily kilometers for estimate');
 assert.equal(t('Următoarea citire de kilometraj','en'),'Next mileage reading');
});
test('dynamic mileage messages preserve the actual values',()=>{
 assert.equal(t('15,000 km rămași','en'),'15,000 km remaining');
 assert.equal(t('Mai sunt 15,000 km','en'),'15,000 km remaining');
 assert.equal(t('Depășit cu 1,500 km','en'),'Overdue by 1,500 km');
 assert.equal(t('23 zile estimate','en'),'23 estimated days');
 assert.equal(t('Medie calculată: 42.5 km/zi.','en'),'Calculated average: 42.5 km/day.');
 assert.equal(t('Reintrodu kilometrii în jurul datei de 12/11/2026','en'),'Update your odometer reading around 12/11/2026');
});
test('language switching restores Romanian and handles React-updated content',()=>{
 const source='Următoarea citire de kilometraj';const rendered=t(source,'en');
 assert.equal(t(translationSource(rendered,{source,rendered}),'ro'),source);
 assert.equal(t(translationSource('Actualizează kilometrajul',{source,rendered}),'en'),'Update mileage');
 assert.equal(t('BMW M4 · TM 05 FFX','en'),'BMW M4 · TM 05 FFX');
 assert.equal(t('Revizie personalizată la atelierul meu','en'),'Revizie personalizată la atelierul meu');
 assert.equal(t('RON 150.00','en'),'RON 150.00');
 assert.equal(t('ȘTERGE','en'),'ȘTERGE');
});
test('maintenance form labels and options have reviewed English copy without changing submitted values',()=>{
 const source=readFileSync('src/components/service-detail-fields.tsx','utf8');
 const ast=ts.createSourceFile('fields.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let labels=0;
 function visit(node:ts.Node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='field'){
   const label=node.arguments[1];
   if(label&&ts.isStringLiteral(label)){labels++;assert.notEqual(t(label.text,'en'),label.text,`Untranslated field: ${label.text}`);}
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);assert.ok(labels>50);
 assert.match(source,/<option key=\{x\} value=\{x\}>/);
});
test('all Romanian static application UI text has an English translation',()=>{
 const files=['dashboard','garage-home','record-editor','service-detail-fields','smartdrive-history','service-forecast-cards','smartdrive-trip','membership','mobile-install','push-settings','communication-preferences','support-chat','founder-panel','mail-center','google-mail-settings'];
 const missing=new Set<string>();
 for(const name of files){const ast=ts.createSourceFile(name+'.tsx',readFileSync('src/components/'+name+'.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node:ts.Node){
  if(ts.isJsxText(node)){const value=normalizeCopy(node.text);if(/[ăâîșțĂÂÎȘȚ]/.test(value)&&value!=='ȘTERGE'&&t(value,'en')===value)missing.add(name+': '+value);}
  ts.forEachChild(node,visit);
 }visit(ast);}
 assert.deepEqual([...missing],[]);
});
