import SiteDocument,{metadata as siteMetadata,viewport as siteViewport} from '@/components/site-document';
export const metadata=siteMetadata;
export const viewport=siteViewport;
export const revalidate=300;
export default function Layout({children}:{children:React.ReactNode}){return <SiteDocument language="ro">{children}</SiteDocument>;}
