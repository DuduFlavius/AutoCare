import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {renderEmail} from '../src/lib/email-templates';
process.env.APP_URL='https://www.autocareapp.ro';
test('Reference email uses a sharp same-domain banner, live text and both real destinations',async()=>{
 const out=renderEmail('administrative',{name:'Flavius Dudu'});
 assert.match(out.html,/https:\/\/www.autocareapp.ro\/email-banner.jpg/);
 assert.doesNotMatch(out.html,/onrender.com/);
 for(const copy of ['Salut, Flavius Dudu!','Noutăți despre contul tău AutoCare.','Ai primit o actualizare administrativă','Deschide aplicația','Vizitează site-ul','Preferințe de comunicare'])assert.ok(out.html.includes(copy),copy);
 assert.match(out.html,/href="https:\/\/www.autocareapp.ro\/cont"/);assert.match(out.html,/href="https:\/\/www.autocareapp.ro\/"/);
 const image=await sharp('public/email-banner.jpg').metadata();assert.equal(image.width,1049);assert.equal(image.height,487);
 const secret='https://www.autocareapp.ro/api/auth/verify-email?token=synthetic-token';
 const security=renderEmail('verification',{actionUrl:secret,ctaLabel:'Confirmă adresa de email'});assert.ok(security.html.includes('href="'+secret+'"'));assert.ok(security.html.includes('Confirmă adresa de email'));
 const deletion=renderEmail('administrative',{actionUrl:secret,ctaLabel:'Confirmă ștergerea definitivă'});assert.ok(deletion.html.includes('Confirmă ștergerea definitivă'));
 const english=renderEmail('administrative',{language:'en',name:'Alex'});assert.ok(english.html.includes('Open the app'));assert.ok(english.html.includes('Visit website'));assert.match(english.html,/html lang="en"/);
});
