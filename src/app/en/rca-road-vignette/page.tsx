import {RenewalPublicPage,renewalMetadata} from '@/components/renewal-public-page';
export function generateMetadata(){return renewalMetadata('en');}
export default function Page(){return <RenewalPublicPage language="en"/>;}
