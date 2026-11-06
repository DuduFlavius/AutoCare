import { CarArt } from '../car-art';
/** Decorative vehicle illustration; never substitutes a saved vehicle photo. */
export default function VehicleVisual() {
  return <div className="app-vehicle-visual" aria-hidden="true"><CarArt/><span className="app-vehicle-visual-shade"/></div>;
}
