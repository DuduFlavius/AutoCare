import {notFound} from 'next/navigation';
import ControlsReview from '@/components/controls-review';
export const dynamic='force-dynamic';
export const metadata={title:'AutoCare · UI review',robots:{index:false,follow:false}};
export default function Page(){if(process.env.VERCEL_ENV==='production'||process.env.RENDER==='true')notFound();return <ControlsReview/>;}
