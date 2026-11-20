import Image from 'next/image';
export function LandingCockpit() {
  return <figure className="ac-landing-cockpit"><Image src="/images/autocare-racing-green-preview.png" alt="AutoCare Premium: garaj digital pentru documente, istoric service și cheltuieli auto" width={1200} height={630} priority style={{width:'100%',height:'auto',borderRadius:24}}/><figcaption>Garajul tău digital · AutoCare Premium</figcaption></figure>;
}
