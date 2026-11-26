import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import OpenApp from '@/components/open-app';
import {safeAppDestination} from '@/lib/app-links';
import './style.css';
export const metadata={title:'Deschide AutoCare',robots:{index:false,follow:false}};
export default async function OpenApplication({searchParams}:{searchParams:Promise<{next?:string;lang?:string}>}){
 const params=await searchParams;
 const destination=safeAppDestination(params.next);
 const userAgent=(await headers()).get('user-agent')??'';
 if(!/Android|iPhone|iPad|iPod/i.test(userAgent))redirect(destination);
 return <OpenApp destination={destination} english={params.lang==='en'}/>;
}
