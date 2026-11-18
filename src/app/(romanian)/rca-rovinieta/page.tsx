import {RenewalPublicPage,renewalMetadata} from '@/components/renewal-public-page';
export function generateMetadata(){return renewalMetadata('ro');}
export default function Page(){return <RenewalPublicPage/>;}
