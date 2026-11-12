/** Original artwork extracted from the user-provided reference. Never contains user records. */
export type ReferenceArtworkName='wordmark'|'gear'|'car'|'wrench'|'calendar'|'document'|'gauge'|'chart'|'garage'|'appointment'|'activity'|'documents'|'car-badge'|'check-badge'|'crown'|'wave'|'plane'|'garage-button'|'search'|'download'|'nav-home'|'nav-car'|'nav-service'|'nav-calendar'|'nav-expenses'|'nav-reports'|'nav-history'|'nav-documents'|'nav-gps'|'nav-bell'|'nav-settings'|'nav-support'|'nav-account';
export default function ReferenceArtwork({name,width=32,height=width,className='',alt=''}:{name:ReferenceArtworkName;width?:number;height?:number;className?:string;alt?:string}){
 return <img className={'ac-reference-artwork '+className} src={'/dashboard-reference/'+name+'.svg'} width={width} height={height} alt={alt} aria-hidden={alt?undefined:true} draggable={false}/>;
}
