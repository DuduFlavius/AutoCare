import {authPageMetadata,renderAuthPage,type AuthPageProps} from '@/components/public-auth-page';
export const dynamic='force-dynamic';
export const metadata=authPageMetadata('ro','recuperare-parola');
export default function Page(props:AuthPageProps){return renderAuthPage('ro','recuperare-parola',props);}
