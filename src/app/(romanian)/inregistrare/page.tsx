import {authPageMetadata,renderAuthPage,type AuthPageProps} from '@/components/public-auth-page';
export const dynamic='force-dynamic';
export const metadata=authPageMetadata('ro','inregistrare');
export default function Page(props:AuthPageProps){return renderAuthPage('ro','inregistrare',props);}
