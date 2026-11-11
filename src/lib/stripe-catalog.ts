import type Stripe from 'stripe';
import {billingAmount,billingRecurrence,type BillingCurrency,type BillingInterval} from './billing-currency';
import {AppError} from './service';
type Configured={monthlyPriceId:string|null;annualPriceId:string|null;monthlyBani:number;annualBani:number};
export function matchesBillingPrice(price:Stripe.Price,interval:BillingInterval,currency:BillingCurrency,amount:number) {
 const recurrence=billingRecurrence(interval);
 const remoteAmount=price.currency===currency?price.unit_amount:price.currency_options?.[currency]?.unit_amount;
 return price.active&&price.type==='recurring'&&remoteAmount===amount&&price.billing_scheme==='per_unit'&&!price.recurring?.usage_type?.includes('metered')&&price.recurring?.interval===recurrence.interval&&price.recurring.interval_count===recurrence.interval_count;
}
export async function resolveBillingPrice(client:Stripe,configured:Configured,interval:BillingInterval,currency:BillingCurrency) {
 const stem=interval.toUpperCase();
 const baseId=process.env[`STRIPE_${stem}_PRICE_ID`]||(interval==='annual'?configured.annualPriceId:interval==='monthly'?configured.monthlyPriceId:null);
 const selectedId=currency==='eur'?process.env[`STRIPE_${stem}_EUR_PRICE_ID`]:baseId;
 const amount=currency==='eur'?billingAmount(interval,currency):interval==='annual'?configured.annualBani:configured.monthlyBani*(interval==='quarterly'?3:1);
 const read=(id:string)=>client.prices.retrieve(id,{expand:['currency_options']});
 if(selectedId){const price=await read(selectedId);if(!matchesBillingPrice(price,interval,currency,amount))throw new AppError(503,'Prețul Stripe nu corespunde monedei, sumei sau perioadei selectate.');return {price,amount,currency};}
 if(!baseId)throw new AppError(503,'Prețul Stripe nu este configurat pentru acest abonament.');
 // Reuse an existing multi-currency price, or discover EUR only under the same product.
 const base=await read(baseId);
 if(matchesBillingPrice(base,interval,currency,amount))return {price:base,amount,currency};
 const product=typeof base.product==='string'?base.product:base.product.id;
 const candidates:Stripe.Price[]=[];
 for await(const p of client.prices.list({product,active:true,type:'recurring',limit:100,expand:['data.currency_options']})) {
  if(matchesBillingPrice(p,interval,currency,amount))candidates.push(p);
 }
 if(candidates.length!==1)throw new AppError(503,candidates.length?'Există mai multe prețuri EUR potrivite. Configurează identificatorul Stripe exact.':'Prețul EUR nu este disponibil pentru acest abonament.');
 return {price:candidates[0],amount,currency};
}
