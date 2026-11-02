/** Shared decorative illustration for the active vehicle on web and installed PWA. */
export default function VehicleVisual() {
  return (
    <div className="app-vehicle-visual" aria-hidden="true">
      <img
        src="/images/autocare-app-premium.webp"
        alt=""
        fetchPriority="high"
        decoding="async"
      />
      <span className="app-vehicle-visual-shade" />
    </div>
  );
}
