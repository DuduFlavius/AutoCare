import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isMaintenancePublicAsset} from '../src/lib/maintenance-public-assets';
import {emailAssets} from '../src/lib/email-assets';
test('maintenance permits the exact public email artwork and installation resources',()=>{
 for(const asset of Object.values(emailAssets))assert.equal(isMaintenancePublicAsset(asset.path),true);
 for(const path of ['/manifest.webmanifest','/apple-splash','/apple-touch-icon.png','/favicon.svg','/sw.js','/offline.html'])assert.equal(isMaintenancePublicAsset(path),true);
});
test('asset exemptions cannot open private pages, APIs or arbitrary files',()=>{
 for(const path of ['/cont','/cont?tab=Documente','/api/v1/files/123','/api/auth/user','/email/private.pdf','/email/anything.png','/email/../cont','/brand/other.svg','/apple-splash/private','/manifest.webmanifest/private','/sw.js/private'])assert.equal(isMaintenancePublicAsset(path),false,path);
});
