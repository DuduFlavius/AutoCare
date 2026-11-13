import {authPageMetadata,renderAuthPage,type AuthPageProps} from '@/components/public-auth-page';
export const dynamic='force-dynamic';
export const metadata=authPageMetadata('ro','resetare-parola');
export default function Page(props:AuthPageProps){return renderAuthPage('ro','resetare-parola',props);}
