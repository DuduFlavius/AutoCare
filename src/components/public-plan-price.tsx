'use client';
import {useBillingCurrency} from './use-billing-currency';
export default function PublicPlanPrice({bani,interval}:{bani:number;interval?:'month'|'year'}) {
 const {currency,en}=useBillingCurrency();
 const amount=new Intl.NumberFormat(en?'en-GB':'ro-RO',{maximumFractionDigits:2}).format(bani/(currency==='eur'?500:100));
 return <b className="ac-plan-inline-price" data-workspace-ui>{amount} <small>{currency.toUpperCase()}{interval?(interval==='month'?(en?' / month':' / lună'):(en?' / year':' / an')):''}</small></b>;
}
