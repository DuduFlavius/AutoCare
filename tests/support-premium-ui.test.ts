import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
// CSS is evaluated by the browser/build; this test checks actual React markup and separation.
registerHooks({load(url,context,next){if(url.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return next(url,context);}});
test('human support renders separate staff/client experiences without any AI draft controls',async()=>{
 const {default:SupportChat}=await import('../src/components/support-chat');
 const staff=renderToStaticMarkup(createElement(SupportChat,{role:'admin',preview:true}));
 const client=renderToStaticMarkup(createElement(SupportChat,{role:'user',preview:true}));
 assert.match(staff,/Centru de suport/);assert.match(staff,/Caută conversații/);assert.match(staff,/Statistici/);
 assert.doesNotMatch(client,/Caută conversații|support-stats-trigger/);
 assert.match(client,/Asistență AutoCare/);
 for(const html of [staff,client])assert.doesNotMatch(html,/SupportAiDraft|AI Support Assistant|Întreabă asistentul|Generează propunerea|auto-assistant/);
 // The standalone automotive AI remains its own workspace.
 const ai=await readFile('src/components/application/auto-ai-workspace.tsx','utf8');
 assert.match(ai,/AutoCare AI/);assert.doesNotMatch(ai,/support\/chat|SupportChat/);
});
