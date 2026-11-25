'use client';

import { driveRouting } from '@/lib/drive-routing';
import { nativeTracking } from '@/lib/native-tracking';
import type { DestinationCategory } from '@/lib/road-provider-data';
import type { Coordinate } from '@/lib/road-navigation';
import { destinationIdentity, type SavedDestination } from '@/lib/drive-destinations';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Briefcase, Building2, Clock3, Fuel, House, MapPin, Mic, ParkingCircle, Search, Star, X, Zap } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

export type DriveDestination = SavedDestination & { distanceKm?: number };
type Recognition = {
  lang: string;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const categoryIcons: Record<DestinationCategory, typeof MapPin> = {
  address: MapPin, city: Building2, parking: ParkingCircle, fuel: Fuel, charging: Zap, poi: MapPin,
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function HighlightDestination({ text, query }: { text: string; query: string }) {
  const words = query.match(/[\p{L}\p{N}]+/gu)?.map(normalize) || [];
  return !words.length ? text : text.split(/([\p{L}\p{N}]+)/gu).map((part, i) =>
    part && words.some(word => normalize(part).startsWith(word)) ? <mark key={i}>{part}</mark> : part);
}

export default function DriveDestinationSearch({
  area, nearPosition, disabled, english, recent = [], favorites = [],
  onChoose, onFocusChange, onRemoveRecent, onClearRecent,
}: {
  area: Coordinate;
  nearPosition: boolean;
  disabled: boolean;
  english: boolean;
  recent?: SavedDestination[];
  favorites?: SavedDestination[];
  onFocusChange?: (focused: boolean) => void;
  onChoose: (point: DriveDestination) => void;
  onRemoveRecent?: (point: SavedDestination) => void;
  onClearRecent?: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const position = useRef(area);
  position.current = area;
  const pending = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speech = useRef<Recognition | null>(null);
  const voiceRevision = useRef(0);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<DriveDestination[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const t = (ro: string, en: string) => english ? en : ro;
  const distance = new Intl.NumberFormat(english ? 'en-GB' : 'ro-RO', { maximumFractionDigits: 1 });

  useEffect(() => {
    const browser = window as SpeechWindow;
    if (Capacitor.getPlatform() === 'android') {
      let live = true;
      void nativeTracking.appVersion().then(version => { if (live) setCanSpeak(version.versionCode >= 26); }).catch(() => {});
      return () => {live = false; voiceRevision.current++; speech.current?.abort();};
    }
    setCanSpeak(!!(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => { voiceRevision.current++; speech.current?.abort(); };
  }, []);

  function setText(text: string) {
    pending.current?.abort();
    setQuery(text.slice(0, 160));
    setMatches(null);
    setLoading(false);
    setError('');
  }
  function focus(value: boolean) {
    setFocused(value);
    onFocusChange?.(value);
  }
  function close() {
    voiceRevision.current++;
    speech.current?.abort();
    setListening(false);
    setVoiceError(false);
    setText('');
    focus(false);
    input.current?.blur();
  }
  function choose(point: DriveDestination) {
    close();
    onChoose(point);
  }

  async function find(text: string) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    setMatches(null);
    try {
      const { latitude, longitude } = position.current;
      const results = await driveRouting.search(text, latitude, longitude, controller.signal);
      if (!controller.signal.aborted) setMatches(results);
    } catch (reason) {
      if (!controller.signal.aborted) setError(!navigator.onLine
        ? t('Fără internet. Reconectează-te și reîncearcă.', 'You are offline. Retry after reconnecting.')
        : reason instanceof Error && reason.message.includes('Prea multe')
          ? t('Prea multe căutări. Reîncearcă în câteva momente.', 'Too many searches. Try again shortly.')
          : t('Căutarea a eșuat. Reîncearcă sau alege un punct pe hartă.', 'Search failed. Try again or choose a point on the map.'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const text = query.trim();
    if (!focused || disabled || text.length < 3) return;
    const timer = setTimeout(() => void find(text), 650);
    debounce.current = timer;
    return () => { clearTimeout(timer); pending.current?.abort(); };
  }, [query, disabled, focused, english]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || loading || query.trim().length < 3) return;
    if (debounce.current) clearTimeout(debounce.current);
    void find(query.trim());
  }

  async function startVoice() {
    const revision = ++voiceRevision.current;
    setVoiceError(false);
    focus(true);
    setListening(true);
    const accept = (value: string) => {
      if (voiceRevision.current !== revision || !value.trim()) return;
      setText(value);
    };
    if (Capacitor.getPlatform() === 'android') {
      input.current?.blur();
      try { accept(await nativeTracking.recognizeDestination(english)); }
      catch { if (voiceRevision.current === revision) setVoiceError(true); }
      finally { if (voiceRevision.current === revision) setListening(false); }
      return;
    }
    const browser = window as SpeechWindow;
    const Recognizer = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    try {
      if (!Recognizer) throw new Error('Speech recognition unavailable');
      const recognition = new Recognizer();
      speech.current = recognition;
      recognition.lang = english ? 'en-GB' : 'ro-RO';
      recognition.onresult = event => accept(event.results[0]?.[0]?.transcript || '');
      recognition.onerror = () => { if (voiceRevision.current === revision) setVoiceError(true); };
      recognition.onend = () => { if (voiceRevision.current === revision) setListening(false); };
      recognition.start();
    } catch { setListening(false); setVoiceError(true); }
  }

  return <section className="ac-destination-search" aria-label={t('Caută destinația', 'Search destination')} data-expanded={focused}
    onKeyDown={event => { if (event.key === 'Escape' && focused) { event.preventDefault(); close(); } }}>
    <form onSubmit={submit}>
      <label className="sd-destination-label" htmlFor={id}>{t('Unde mergem?', 'Where to?')}</label>
      <div className="ac-destination-search-row">
        {focused && <button type="button" aria-label={t('Înapoi la hartă', 'Back to map')} onClick={close}><ArrowLeft size={20} aria-hidden="true"/></button>}
        <button type="submit" className="sd-search-submit" aria-label={t('Caută', 'Search')} disabled={disabled || loading || query.trim().length < 3}><Search size={20} aria-hidden="true"/></button>
        <input ref={input} id={id} type="search" placeholder={t('Unde mergem?', 'Where to?')} value={query}
          onFocus={() => focus(true)} onChange={event => setText(event.target.value)} disabled={disabled} autoComplete="off" enterKeyHint="search"
          maxLength={160} aria-autocomplete="list" aria-controls={focused ? id + '-results' : undefined}/>
        {!!query && <button type="button" aria-label={t('Șterge căutarea', 'Clear search')} onClick={() => { setText(''); input.current?.focus(); }}><X size={18} aria-hidden="true"/></button>}
        {canSpeak && <button type="button" aria-label={t('Caută vocal', 'Voice search')} disabled={disabled || listening} onClick={() => void startVoice()}><Mic size={19} aria-hidden="true"/></button>}
      </div>
    </form>
    {focused && <div className="sd-destination-results" id={id + '-results'} aria-busy={loading}>
      {listening && <p role="status">{t('Ascult destinația…', 'Listening…')}</p>}
      {voiceError && <p role="alert">{t('Căutarea vocală este indisponibilă. Scrie adresa în câmpul de căutare.', 'Voice search is unavailable. Type the address instead.')}</p>}
      {loading && <p role="status">{t('Caut destinația…', 'Finding your destination…')}</p>}
      {error && <p role="alert">{error} <button type="button" onClick={() => void find(query.trim())}>{t('Reîncearcă', 'Retry')}</button></p>}
      {matches?.length === 0 && <p role="status">{t('Nicio destinație găsită. Încearcă strada și localitatea.', 'No destination found. Try the street and town.')}</p>}
      {!!matches?.length && <ul aria-label={t('Destinații găsite', 'Matching destinations')}>{matches.map(point => {
        const Icon = categoryIcons[point.category ?? 'address'] || MapPin;
        return <li key={destinationIdentity(point)}><button type="button" onClick={() => choose(point)}>
          <span className="sd-result-icon"><Icon size={18} aria-hidden="true"/></span>
          <span className="sd-result-text" data-user-content><strong><HighlightDestination text={point.name} query={query}/></strong>
            {point.details && <small><HighlightDestination text={point.details} query={query}/></small>}</span>
          {nearPosition && point.distanceKm != null && <small className="sd-result-distance" title={t('Distanță în linie dreaptă', 'Straight-line distance')}>{distance.format(point.distanceKm)} km</small>}
        </button></li>;
      })}</ul>}
      {!query.trim() && <>
        {favorites.length > 0 && <div className="sd-destination-favorites" aria-label={t('Favorite', 'Favorites')}>{favorites.map(point => {
          const Icon = point.kind === 'home' ? House : point.kind === 'work' ? Briefcase : Star;
          return <button key={point.kind + ':' + destinationIdentity(point)} type="button" onClick={() => choose(point)}><Icon size={17} aria-hidden="true"/>
            <span>{point.kind === 'home' ? t('Acasă','Home') : point.kind === 'work' ? t('Serviciu','Work') : point.name}</span></button>;
        })}</div>}
        {recent.length > 0 && <>
          <div className="sd-recent-heading"><strong>{t('Recente','Recent')}</strong><button type="button" onClick={onClearRecent}>{t('Golește istoricul','Clear history')}</button></div>
          <ul aria-label={t('Destinații recente', 'Recent destinations')}>{recent.map(point => <li key={destinationIdentity(point)}>
            <button type="button" onClick={() => choose(point)}><span className="sd-result-icon"><Clock3 size={17} aria-hidden="true"/></span>
              <span className="sd-result-text" data-user-content><strong>{point.name}</strong>{point.details && <small>{point.details}</small>}</span></button>
            <button className="sd-remove-recent" type="button" aria-label={t('Elimină din recente: ', 'Remove from recent: ') + point.name} onClick={() => onRemoveRecent?.(point)}><X size={17} aria-hidden="true"/></button>
          </li>)}</ul>
        </>}
        {!recent.length && !favorites.length && <p>{t('Caută o adresă, o localitate sau un punct de interes.', 'Search for an address, town or point of interest.')}</p>}
      </>}
      {query.trim().length > 0 && query.trim().length < 3 && <p>{t('Scrie cel puțin 3 caractere.', 'Enter at least 3 characters.')}</p>}
    </div>}
  </section>;
}
