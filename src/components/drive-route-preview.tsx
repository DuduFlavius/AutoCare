import { Clock3, MapPin, Navigation, Route, X } from 'lucide-react';
import type { DrivingRoute } from '@/lib/road-navigation';

export default function DriveRoutePreview({ destination, routes, selected, english, pending, error, disabled, onSelect, onStart, onClose }: {
  destination: {name?: string; details?: string};
  routes: DrivingRoute[];
  selected: number;
  english: boolean;
  pending: boolean;
  error?: string;
  disabled: boolean;
  onSelect: (index: number) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const t = (ro: string, en: string) => english ? en : ro;
  const locale = english ? 'en-GB' : 'ro-RO';
  const route = routes[selected];
  const kilometers = (meters: number) => new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(meters / 1000) + ' km';
  const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));
  const eta = route ? new Intl.DateTimeFormat(locale, {hour:'2-digit',minute:'2-digit'}).format(Date.now() + route.duration * 1000) : '';
  return <section className="sd-route-preview" aria-label={t('Previzualizare traseu', 'Route preview')}>
    <header className="sd-preview-header">
      <span className="sd-preview-pin"><MapPin size={21} aria-hidden="true"/></span>
      <div data-user-content><strong>{destination.name || t('Punct ales pe hartă', 'Point selected on map')}</strong>
        {destination.details && <small>{destination.details}</small>}</div>
      <button type="button" onClick={onClose} aria-label={t('Închide traseul', 'Close route')}><X size={18} aria-hidden="true"/></button>
    </header>
    {route && <>
      <dl className="sd-preview-stats">
        <div><dt>{t('Sosire estimată', 'Estimated arrival')}</dt><dd>{eta}</dd></div>
        <div><dt><Clock3 size={14} aria-hidden="true"/>{t('Durată', 'Duration')}</dt><dd>{minutes(route.duration)} min</dd></div>
        <div><dt><Route size={14} aria-hidden="true"/>{t('Distanță', 'Distance')}</dt><dd>{kilometers(route.distance)}</dd></div>
      </dl>
      {routes.length > 1 && <div className="sd-preview-options" role="group" aria-label={t('Trasee alternative', 'Alternative routes')}>
        {routes.map((option, index) => <button type="button" aria-pressed={index === selected} onClick={() => onSelect(index)} key={index}>
          <span>{t('Traseul', 'Route')} {index + 1}</span><strong>{minutes(option.duration)} min · {kilometers(option.distance)}</strong></button>)}
      </div>}
      <button className="sd-preview-start primary" type="button" disabled={disabled || pending} onClick={onStart}><Navigation size={20} aria-hidden="true"/>{t('Pornește navigația','Start navigation')}</button>
    </>}
    {pending && <p role="status">{t('Se calculează traseul…', 'Calculating route…')}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
