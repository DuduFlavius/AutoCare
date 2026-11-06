import {Gauge} from 'lucide-react';
/** Decorative instrumentation. Never represents an uploaded vehicle photograph. */
export default function VehicleVisual() {
 return <div className="app-vehicle-visual ac-instrument-visual" aria-hidden="true"><div className="ac-instrument-grid"/><div className="ac-instrument-orbit"><Gauge size={100} strokeWidth={.65}/></div><span className="app-vehicle-visual-shade"/></div>;
}
