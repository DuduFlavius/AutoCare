'use client';
import VehicleSymbol from '../vehicle-symbol';
/** Photos remain stored and downloadable; the product presents only vector vehicle identities. */
export default function VehiclePhoto(_props:{vehicleId:string;name:string;uploaded?:boolean;preview?:boolean;priority?:boolean;illustration?:boolean}) {
 return <div className="studio-vehicle-photo"><VehicleSymbol/></div>;
}
