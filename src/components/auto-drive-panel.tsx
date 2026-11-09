'use client';
import { useEffect, useState } from 'react';
import {
  hasNativeTracking,
  nativeAutomation,
  nativeMethodMissing,
  type AutoStatus,
  type NativeTrip,
} from '@/lib/native-tracking';
import { syncAutomaticTrips } from '@/lib/sync-automatic-trips';
export default function AutoDrivePanel({
  ownerId,
  vehicles,
  english,
  onUpdated,
  preview,
}: {
  ownerId: string;
  vehicles: { id: string; brand: string; model: string; odometer: number }[];
  english: boolean;
  onUpdated: () => Promise<unknown>;
  preview: boolean;
}) {
  const [status, setStatus] = useState<AutoStatus | null>(null),
    [supported, setSupported] = useState(false),
    [selected, setSelected] = useState(''),
    [devices, setDevices] = useState<{ name: string; address: string }[]>([]),
    [device, setDevice] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [pending, setPending] = useState<NativeTrip[]>([]);
  const car = vehicles.find((v) => v.id === selected) || vehicles[0];
  const binding = status?.bindings.find((b) => b.vehicleId === car?.id && b.enabled);
  async function reload() {
    const [s, p] = await Promise.all([
      nativeAutomation.status(ownerId),
      nativeAutomation.pending(ownerId),
    ]);
    setStatus(s);
    setPending(p);
    setSupported(s.platform === 'android' && s.apiVersion >= 5 && s.supported);
  }
  useEffect(() => {
    if (preview || !hasNativeTracking()) return;
    let disposed = false;
    nativeAutomation
      .status(ownerId)
      .then((s) => {
        if (!disposed) {
          setStatus(s);
          setSupported(s.platform === 'android' && s.apiVersion >= 5 && s.supported);
        }
      })
      .catch((e) => {
        if (!disposed && !nativeMethodMissing(e))
          setError(e instanceof Error ? e.message : 'GPS unavailable');
      });
    const sync = () => {
      if (!disposed) void reload().catch(() => {});
    };
    void nativeAutomation
      .pending(ownerId)
      .then((p) => {
        if (!disposed) setPending(p);
      })
      .catch(() => {});
    window.addEventListener('autocare-native-synced', sync);
    const timer = setInterval(sync, 10000);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('autocare-native-synced', sync);
    };
  }, [ownerId, preview]);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GPS unavailable');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ac-auto-drive" data-workspace-ui>
      <header>
        <span className="eyebrow">AUTOCARE · AUTODRIVE</span>
        <h3>
          {english
            ? 'Your car connects. Your trip begins.'
            : 'Mașina se conectează. Traseul începe.'}
        </h3>
        <p>
          {english
            ? 'Your selected car Bluetooth prepares GPS. A trip starts only after sustained movement is confirmed.'
            : 'Bluetooth-ul mașinii pregătește GPS-ul. Călătoria începe doar după confirmarea deplasării.'}
        </p>
      </header>
      <p>{english?'GPS distance is an estimate. Bluetooth does not read the dashboard odometer. Very slow movement is excluded to reduce walking and stationary drift.':'Distanța este estimată prin GPS. Bluetooth-ul nu citește kilometrajul din bord. Mișcarea foarte lentă este exclusă pentru a reduce mersul pe jos și erorile la staționare.'}</p>
      <p>
        {english
          ? 'Enabling AutoDrive allows trip recording and mileage sync when you next open AutoCare. Your historical service mileage stays unchanged.'
          : 'Activarea AutoDrive permite înregistrarea traseelor și sincronizarea kilometrilor la următoarea deschidere AutoCare. Kilometrajul intervențiilor vechi rămâne neschimbat.'}
      </p>
      {!supported ? (
        <p>
          {english
            ? 'Automatic Bluetooth requires the updated native Android app and a compatible car audio system. Start GPS manually on the web or iPhone.'
            : 'Pornirea prin Bluetooth necesită aplicația nativă Android actualizată și un sistem audio auto compatibil. În browser sau pe iPhone, pornește GPS-ul manual.'}
        </p>
      ) : (
        <>
          <label>
            {english ? 'Vehicle' : 'Mașină'}
            <select
              disabled={busy}
              value={car?.id || ''}
              onChange={(e) => {
                setSelected(e.target.value);
                setDevice('');
                setNotice('');
                setError('');
              }}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} data-user-content>
                  {v.brand} {v.model}
                </option>
              ))}
            </select>
          </label>
          {status?.platform === 'android' ? (
            <>
              <p>
                {english
                  ? 'Pair your car in phone Bluetooth settings first. AutoDrive needs precise location, Allow all the time, Bluetooth and notifications.'
                  : 'Asociază întâi mașina în setările Bluetooth ale telefonului. AutoDrive necesită locație precisă, acces Tot timpul, Bluetooth și notificări.'}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => setDevices(await nativeAutomation.devices(ownerId)))
                }
              >
                {english ? 'Choose paired Bluetooth device' : 'Alege Bluetooth-ul asociat'}
              </button>
              {devices.length > 0 && (
                <label>
                  {english ? 'Select only your car: name and Bluetooth address' : 'Selectează doar mașina ta: nume și adresă Bluetooth'}
                  <select
                    value={device}
                    disabled={busy}
                    onChange={(e) => setDevice(e.target.value)}
                  >
                    <option value="">{english ? 'Choose device' : 'Alege dispozitivul'}</option>
                    {devices.map((d) => (
                      <option key={d.address} value={d.address} data-user-content>
                        {d.name} · {d.address}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <div className="ac-auto-steps">
              <p>
                {english
                  ? 'Allow Always and Precise Location. Then create two personal automations in Apple Shortcuts:'
                  : 'Permite localizarea Întotdeauna și Locație precisă. Apoi creează două automatizări personale în Apple Scurtături:'}
              </p>
              <ol>
                <li>
                  {english
                    ? 'Bluetooth/CarPlay connects → Start AutoCare trip → select this vehicle.'
                    : 'Conectare Bluetooth/CarPlay → Pornește traseul AutoCare → alege această mașină.'}
                </li>
                <li>
                  {english
                    ? 'CarPlay disconnects (or Bluetooth disconnect trigger where available) → End AutoCare trip → same vehicle.'
                    : 'Deconectare CarPlay (sau Bluetooth, unde există acest declanșator) → Încheie traseul AutoCare → aceeași mașină.'}
                </li>
                <li>
                  {english
                    ? 'Choose Run Immediately. If iOS requests confirmation, that action still requires user interaction.'
                    : 'Alege Executare imediată. Dacă iOS cere confirmare, acțiunea necesită în continuare intervenția utilizatorului.'}
                </li>
              </ol>
            </div>
          )}
          <div className="ac-auto-actions">
            <button
              type="button"
              disabled={busy || !car || (status?.platform === 'android' && !device)}
              className="primary"
              onClick={() =>
                void act(async () => {
                  if (!car) return;
                  await nativeAutomation.configure({
                    ownerId,
                    vehicleId: car.id,
                    vehicleName: car.brand + ' ' + car.model,
                    baseline: car.odometer,
                    ...(device ? { address: device } : {}),
                  });
                  await reload();
                  setNotice(
                    english
                      ? 'Vehicle configured. Finish the phone permissions and, on iPhone, the Shortcuts setup.'
                      : 'Mașină configurată. Verifică permisiunile și, pe iPhone, finalizează automatizările Scurtături.',
                  );
                })
              }
            >
              {busy
                ? english
                  ? 'Saving…'
                  : 'Se salvează…'
                : english
                  ? 'Enable AutoDrive for this vehicle'
                  : 'Activează AutoDrive pentru mașină'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void nativeAutomation
                  .openSettings()
                  .catch((e) => setError(e instanceof Error ? e.message : 'Settings unavailable'))
              }
            >
              {english ? 'Phone permissions' : 'Permisiunile telefonului'}
            </button>
            {binding && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    if (car) await nativeAutomation.disable(ownerId, car.id);
                    await reload();
                  })
                }
              >
                {english ? 'Disable automatic start' : 'Dezactivează pornirea automată'}
              </button>
            )}
          </div>
          {binding && (
            <p role="status">
              {english ? 'Enabled for: ' : 'Activ pentru: '}
              <span data-user-content>{binding.vehicleName}</span>
              {status?.platform === 'ios'
                ? english
                  ? ' · requires your Shortcuts automations'
                  : ' · necesită automatizările tale Scurtături'
                : ''}
            </p>
          )}
          {pending.length > 0 && (
            <div className="ac-auto-pending">
              <h4>
                {english ? 'Trips waiting to sync' : 'Trasee în așteptarea sincronizării'} ·{' '}
                {pending.length}
              </h4>
              <p>
                {english
                  ? 'Mileage changes are checked on the server. If you entered your dashboard reading already, archive the trips without adding their kilometers again.'
                  : 'Modificările kilometrilor sunt verificate pe server. Dacă ai introdus deja kilometrajul de pe bord, arhivează traseele fără să adaugi din nou kilometrii lor.'}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await syncAutomaticTrips(ownerId, vehicles);
                    await onUpdated();
                    await reload();
                    window.dispatchEvent(new Event('autocare-auto-retry'));
                  })
                }
              >
                {english ? 'Retry safe sync' : 'Reîncearcă sincronizarea sigură'}
              </button>
              {car && pending.some((t) => t.vehicleId === car.id) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      if (
                        !window.confirm(
                          english
                            ? 'Save this vehicle’s trips without adding kilometers?'
                            : 'Salvezi traseele acestei mașini fără să adaugi kilometrii?',
                        )
                      )
                        return;
                      await syncAutomaticTrips(ownerId, vehicles, car.id);
                      await onUpdated();
                      await reload();
                      window.dispatchEvent(new Event('autocare-auto-retry'));
                    })
                  }
                >
                  {english
                    ? 'Archive selected vehicle trips without adding km'
                    : 'Arhivează traseele mașinii selectate fără adăugare km'}
                </button>
              )}
            </div>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {(error || status?.error) && <p role="alert">{error || status?.error}</p>}
    </section>
  );
}
