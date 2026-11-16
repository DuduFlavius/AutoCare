import AccountDeletionPage from '@/components/account-deletion-page';
import {publicMetadata} from '@/lib/seo';
export const metadata=publicMetadata('Delete your AutoCare account and data','Request AutoCare account and personal data deletion from the Android app or website. Learn about identity verification and subscriptions.','/en/delete-account');
export default function Page(){return <AccountDeletionPage language="en"/>;}
