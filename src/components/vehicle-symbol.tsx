import {CarFront,ShieldCheck,Gauge} from 'lucide-react';
/** Pure vector identity: no vehicle photographs or simulated telemetry. */
export default function VehicleSymbol({compact=false}:{compact?:boolean}) {
 return <div className={'ac-vehicle-symbol'+(compact?' is-compact':'')} aria-hidden="true"><span className="ac-symbol-orbit"/><span className="ac-symbol-core"><CarFront size={compact?32:70} strokeWidth={1.15}/></span>{!compact&&<><ShieldCheck className="ac-symbol-check" size={23}/><Gauge className="ac-symbol-gauge" size={23}/><span className="ac-symbol-word">AUTOCARE · DIGITAL GARAGE</span></>}</div>;
}
