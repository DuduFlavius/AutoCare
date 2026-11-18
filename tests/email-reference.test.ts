import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import sharp from 'sharp';
import {emailAssets} from '../src/lib/email-assets';
import {renderEmail} from '../src/lib/email-templates';
process.env.APP_URL='https://www.autocareapp.ro';
test('Reference email uses a sharp same-domain banner, live text and both real destinations',async()=>{
 const out=renderEmail('administrative',{name:'Flavius Dudu'});
 assert.ok(out.html.includes('https://www.autocareapp.ro'+emailAssets.hero.path));
 assert.match(emailAssets.hero.path,/\/email\/autocare-hero-[a-f0-9]{12}\.jpg$/);
 assert.doesNotMatch(out.html,/email-banner\.jpg|email-phone\.png|email-globe\.png/);
 assert.doesNotMatch(out.html,/onrender.com/);
 for(const copy of ['Salut, Flavius Dudu!','Noutăți despre contul tău AutoCare.','Ai primit o actualizare administrativă','Deschide aplicația','Vizitează site-ul','Preferințe de comunicare'])assert.ok(out.html.includes(copy),copy);
 assert.match(out.html,/href="https:\/\/www.autocareapp.ro\/cont"/);assert.match(out.html,/href="https:\/\/www.autocareapp.ro\/"/);
 assert.ok((await stat('public'+emailAssets.hero.path)).size < 160_000);
 const image=await sharp('public'+emailAssets.hero.path).metadata();assert.equal(image.format,'jpeg');assert.equal(image.width,1049);assert.equal(image.height,487);
 for(const asset of [emailAssets.phone,emailAssets.globe]){const icon=await sharp('public'+asset.path).metadata();assert.equal(icon.width,96);assert.equal(icon.height,96);assert.ok(out.html.includes(asset.path));}
 const secret='https://www.autocareapp.ro/api/auth/verify-email?token=synthetic-token';
 const security=renderEmail('verification',{actionUrl:secret,ctaLabel:'Confirmă adresa de email'});assert.ok(security.html.includes('href="'+secret+'"'));assert.ok(security.html.includes('Confirmă adresa de email'));
 const deletion=renderEmail('administrative',{actionUrl:secret,ctaLabel:'Confirmă ștergerea definitivă'});assert.ok(deletion.html.includes('Confirmă ștergerea definitivă'));
 const english=renderEmail('administrative',{language:'en',name:'Alex'});assert.ok(english.html.includes('Open the app'));assert.ok(english.html.includes('Visit website'));assert.match(english.html,/html lang="en"/);
});
