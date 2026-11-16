import AccountDeletionPage from '@/components/account-deletion-page';
import {publicMetadata} from '@/lib/seo';
export const metadata=publicMetadata('Ștergerea contului și a datelor AutoCare','Solicită ștergerea contului AutoCare și a datelor personale direct din aplicație sau website. Pași, verificarea identității și informații despre abonamente.','/stergere-cont');
export default function Page(){return <AccountDeletionPage/>;}
