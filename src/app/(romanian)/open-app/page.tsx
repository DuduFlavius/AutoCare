import OpenApp from '@/components/open-app';
import {safeAppDestination} from '@/lib/app-links';
import './style.css';
export const metadata={title:'Deschide AutoCare',robots:{index:false,follow:false}};
export default async function OpenApplication({searchParams}:{searchParams:Promise<{next?:string;lang?:string}>}){const params=await searchParams;return <OpenApp destination={safeAppDestination(params.next)} english={params.lang==='en'}/>;}
