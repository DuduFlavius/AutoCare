import {authPageMetadata,renderAuthPage,type AuthPageProps} from '@/components/public-auth-page';
export const dynamic='force-dynamic';
export const metadata=authPageMetadata('en','resetare-parola');
export default function Page(props:AuthPageProps){return renderAuthPage('en','resetare-parola',props);}
