'use client';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
interface PushPlugin {
  checkPermissions(): Promise<{receive:string}>;
  requestPermissions(): Promise<{receive:string}>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  removeAllDeliveredNotifications():Promise<void>;
  createChannel(options:{id:string;name:string;importance:number;visibility:number}): Promise<void>;
  addListener(event:'registration', callback:(token:{value:string})=>void):Promise<PluginListenerHandle>;
  addListener(event:'registrationError', callback:(error:{error:string})=>void):Promise<PluginListenerHandle>;
}
const plugin = registerPlugin<PushPlugin>('PushNotifications');
export function hasNativePush() { return Capacitor.getPlatform()==='android' && Capacitor.isPluginAvailable('PushNotifications'); }
let activeToken: string | null = null;
let activation: Promise<void> | null = null;
export async function nativePushPermission() {
  return hasNativePush() ? (await plugin.checkPermissions()).receive : 'unsupported';
}
async function saveToken(token:string, method='POST') {
  const response=await fetch('/api/v1/push/native',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!response.ok)throw Error('Nu s-a putut conecta dispozitivul la notificări.');
}
export async function activateNativePush(requestPermission=true) {
  if (activation) {
    try { await activation; return; }
    catch (error) { if (!requestPermission) throw error; }
  }
  const operation = registerNativePush(requestPermission);
  activation = operation;
  try { await operation; }
  finally { if (activation === operation) activation = null; }
}
async function registerNativePush(requestPermission: boolean) {
  if(!hasNativePush()) throw Error('Actualizează aplicația pentru notificări Android.');
  const config=await fetch('/api/v1/push/native',{cache:'no-store'});
  if(!config.ok || !(await config.json()).configured)throw Error('Notificările nu pot fi activate momentan. Încearcă din nou în câteva momente.');
  let permission=await plugin.checkPermissions();
  if(permission.receive!=='granted' && requestPermission)permission=await plugin.requestPermissions();
  if(permission.receive!=='granted')throw Error('Permite notificările AutoCare din setările telefonului.');
  await plugin.createChannel({id:'autocare-updates',name:'AutoCare',importance:4,visibility:0});
  const handles:PluginListenerHandle[]=[];
  try {
    const token=await new Promise<string>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Conectarea notificărilor a expirat. Încearcă din nou.')),20000);
      const finish=(value?:string)=>{clearTimeout(timer);if(value)resolve(value);else reject(Error('Înregistrarea Android nu a reușit.'));};
      void (async()=>{
        handles.push(await plugin.addListener('registration',value=>finish(value.value)));
        handles.push(await plugin.addListener('registrationError',()=>finish()));
        await plugin.register();
      })().catch(()=>finish());
    });
    await saveToken(token); activeToken=token;
  } finally {await Promise.all(handles.map(handle=>handle.remove()));}
}
export async function disconnectNativePush() {
  if(!hasNativePush()) return;
  // Delete FCM identity before logout, including registrations from a previous app session.
  await plugin.removeAllDeliveredNotifications();
  await plugin.unregister();
  if(activeToken)await saveToken(activeToken,'DELETE');
  activeToken=null;
}
