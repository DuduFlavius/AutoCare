'use client';
import {Capacitor,registerPlugin} from '@capacitor/core';
type Result={cancelled?:boolean;purchases?:{token:string;purchased:boolean}[]};
const billing=registerPlugin<{purchase(input:{productId:string;accountId:string}):Promise<Result>;restore():Promise<Result>}>('AutoCareBilling');
export const hasPlayBilling=()=>Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AutoCareBilling');
async function verify(result:Result){
  if(result.cancelled)return;
  for(const purchase of result.purchases??[]){
    if(!purchase.purchased)continue;
    const response=await fetch('/api/v1/billing/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:purchase.token})});
    if(!response.ok)throw Error('Nu am putut verifica achiziția. Folosește „Restaurează achizițiile”.');
  }
}
export async function purchasePlayPlan(interval:string){
  const response=await fetch('/api/v1/billing/play',{cache:'no-store'});
  if(!response.ok)throw Error('Conectează-te din nou la cont.');
  const config=await response.json();
  if(config.hasActiveSubscription)throw Error('Ai deja un abonament. Gestionează-l la furnizorul unde l-ai activat pentru a evita o plată dublă.');
  if(!config.configured||!config.products[interval])throw Error('Abonamentele Google Play nu sunt încă activate.');
  await verify(await billing.purchase({productId:config.products[interval],accountId:config.accountId}));
}
export async function restorePlayPurchases(){await verify(await billing.restore());}
