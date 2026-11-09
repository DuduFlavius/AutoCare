import { segmentMeters, type GPSFix } from './gps-tracking';

export function createRoadPositionMarker(english = false): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'ac-road-position';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', english ? 'Your GPS position' : 'Poziția ta GPS');
  element.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 3h10l3 6v10h-3v-2H7v2H4V9zm1 2L6 9h12l-2-4zM7 11v3h3v-3zm7 0v3h3v-3z" fill="currentColor" fill-rule="evenodd"/></svg>';
  return element;
}

export function updateRoadPositionMarker(element: HTMLElement | null | undefined, active: boolean, position: GPSFix, trail: GPSFix[]) {
  if (!element) return;
  element.classList.toggle('is-driving', active);
  const last = trail.at(-1);
  const previous = last && last.timestamp < position.timestamp ? last : trail.at(-2);
  const heading = position.heading;
  if (heading != null && Number.isFinite(heading) && heading >= 0 && heading < 360) {
    element.style.setProperty('--gps-bearing', heading + 'deg');
  } else if (previous && !position.breakBefore && position.timestamp - previous.timestamp < 20000 && segmentMeters(previous, position) >= 10) {
    const radians = Math.PI / 180;
    const start = previous.latitude * radians, end = position.latitude * radians;
    const delta = (position.longitude - previous.longitude) * radians;
    const angle = Math.atan2(Math.sin(delta) * Math.cos(end), Math.cos(start) * Math.sin(end) - Math.sin(start) * Math.cos(end) * Math.cos(delta));
    element.style.setProperty('--gps-bearing', angle / radians + 'deg');
  }
}
