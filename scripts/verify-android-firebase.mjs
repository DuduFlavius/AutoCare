/** Client Firebase identifiers ship inside the APK; never accept a server private key here. */
import {readFileSync} from 'node:fs';
const file=process.argv[2]||'mobile/android/app/google-services.json';
const config=JSON.parse(readFileSync(file,'utf8'));
if(config.private_key||config.type==='service_account')throw Error('Server credentials must never be bundled in Android.');
if(config.project_info?.project_id!=='autocare-a1239')throw Error('Unexpected Firebase project.');
const client=config.client?.find(c=>c.client_info?.android_client_info?.package_name==='ro.autocare.garage');
if(!client||client.client_info.mobilesdk_app_id!=='1:681341468265:android:93baad2c7a58c3e8b8ecf8'||!client.api_key?.[0]?.current_key)throw Error('Missing or mismatched production Android Firebase client.');
console.log('Firebase Android configuration verified: autocare-a1239 / ro.autocare.garage');
