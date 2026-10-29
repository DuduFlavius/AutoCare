import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Preview builds skip production-only migrations even without valid database credentials',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','scripts/migrate-mail-center.ts'],{encoding:'utf8',timeout:15000,env:{...process.env,VERCEL_ENV:'preview',DATABASE_URL:'postgres://invalid:invalid@127.0.0.1:1/invalid',LOCAL_DATABASE_PATH:''}});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/migration skipped for Preview/);
 assert.doesNotMatch(result.stdout,/additive migration completed/);
});
test('Production deployments continue to fail when their mandatory migration cannot connect',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','scripts/migrate-mail-center.ts'],{encoding:'utf8',timeout:15000,env:{...process.env,VERCEL_ENV:'production',DATABASE_URL:'postgres://invalid:invalid@127.0.0.1:1/invalid',LOCAL_DATABASE_PATH:''}});
 assert.equal(result.status,1,result.stderr);
 assert.match(result.stderr,/Mail Center migration failed/);
 assert.doesNotMatch(result.stdout,/migration skipped/);
});
