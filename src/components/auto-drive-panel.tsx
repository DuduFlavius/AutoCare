'use client';

import { Bluetooth, BluetoothConnected, CarFront, Radio, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  hasNativeTracking,
  nativeAutomation,
  nativeMethodMissing,
  type AutoStatus,
  type NativeTrip,
  type VehicleConnection,
} from '@/lib/native-tracking';
import { syncAutomaticTrips } from '@/lib/sync-automatic-trips';

type Vehicle = { id: string; brand: string; model: string; odometer: number };

export default function AutoDrivePanel({
  ownerId,
  vehicles,
  english,
  onUpdated,
  preview,
  visible,
}: {
  ownerId: string;
  vehicles: Vehicle[];
  english: boolean;
  onUpdated: () => Promise<unknown>;
  preview: boolean;
  visible: boolean;
}) {
  const t = (ro: string, en: string) => (english ? en : ro);
  const [status, setStatus] = useState<AutoStatus | null>(null);
  const [pending, setPending] = useState<NativeTrip[]>([]);
  const [selected, setSelected] = useState('');
  const [devices, setDevices] = useState<{ name: string; address: string }[] | null>(null);
  const [device, setDevice] = useState('');
  const [connection, setConnection] = useState<{
    vehicleId: string;
    value: VehicleConnection;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const car = vehicles.find((vehicle) => vehicle.id === selected) ?? vehicles[0];
  const carId = car?.id;
  const bindings = status?.bindings.filter((binding) => binding.enabled) ?? [];
  const binding = bindings.find((binding) => binding.vehicleId === carId);
  const address = binding?.address;
  const supported = status?.platform === 'android' && status.apiVersion >= 5 && status.supported;
  const canCheckConnection = supported && status.apiVersion >= 6;
  const live = connection?.vehicleId === carId ? connection?.value : undefined;

  async function reload() {
    const [nextStatus, nextPending] = await Promise.all([
      nativeAutomation.status(ownerId),
      nativeAutomation.pending(ownerId),
    ]);
    setStatus(nextStatus);
    setPending(nextPending);
  }

  useEffect(() => {
    if (!visible || preview || !hasNativeTracking()) return;
    let disposed = false;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const [nextStatus, nextPending] = await Promise.all([
          nativeAutomation.status(ownerId),
          nativeAutomation.pending(ownerId),
        ]);
        if (disposed) return;
        setStatus(nextStatus);
        setPending(nextPending);
      } catch (cause) {
        if (!disposed && !nativeMethodMissing(cause))
          setError(cause instanceof Error ? cause.message : 'Bluetooth unavailable');
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    window.addEventListener('autocare-native-synced', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('autocare-native-synced', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ownerId, preview, visible]);

  useEffect(() => {
    if (!visible || !canCheckConnection || !carId || !address) return;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (document.hidden || checking) return;
      checking = true;
      try {
        const value = await nativeAutomation.vehicleConnection(ownerId, carId);
        if (!disposed) setConnection({ vehicleId: carId, value });
      } catch {
        if (!disposed) setConnection(null);
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 10000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [ownerId, carId, address, canCheckConnection, visible]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t('Bluetooth indisponibil.', 'Bluetooth unavailable.'),
      );
    } finally {
      setBusy(false);
    }
  }

  function chooseVehicle(id: string) {
    setSelected(id);
    setDevices(null);
    setDevice('');
    setConnection(null);
    setError('');
    setNotice('');
  }

  async function sync(archiveVehicle?: string) {
    await syncAutomaticTrips(ownerId, vehicles, archiveVehicle);
    await onUpdated();
    await reload();
    window.dispatchEvent(new Event('autocare-auto-retry'));
  }

  const connectionLabels = {
    connected: t('Conectat la sistemul audio auto', 'Connected to car audio'),
    'not-detected': t('Conexiune nedetectată', 'Connection not detected'),
    off: t('Bluetooth oprit', 'Bluetooth turned off'),
    permission: t('Permisiune Bluetooth necesară', 'Bluetooth permission required'),
    unpaired: t('Asocierea nu mai este disponibilă', 'Pairing is no longer available'),
  };

  return (
    <section className="ac-auto-drive ac-bluetooth-workspace" data-workspace-ui>
      <header>
        <span className="eyebrow">
          <Bluetooth size={16} /> AUTOCARE · AUTODRIVE
        </span>
        <h3>{t('Conectează automobilul', 'Connect Vehicle')}</h3>
        <p>
          {t(
            'Alege sistemul audio auto asociat în Android. GPS-ul începe călătoria după ce detectează deplasare susținută.',
            'Choose a paired Android car audio system. GPS begins recording after sustained movement is detected.',
          )}
        </p>
      </header>
      <div className="ac-bluetooth-grid">
        <section>
          <h4>
            <CarFront size={18} /> {t('Asociere vehicul', 'Vehicle pairing')}
          </h4>
          {vehicles.length > 0 && (
            <label>
              {t('Mașină', 'Vehicle')}
              <select
                value={carId || ''}
                disabled={busy}
                onChange={(event) => chooseVehicle(event.target.value)}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id} data-user-content>
                    {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!supported ? (
            <p>
              {t(
                'Asocierea necesită aplicația nativă Android actualizată și un sistem audio auto compatibil.',
                'Pairing requires the updated native Android app and compatible car audio.',
              )}
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || !carId}
                onClick={() =>
                  void act(async () => {
                    setDevices(await nativeAutomation.devices(ownerId));
                    setDevice('');
                  })
                }
              >
                <Bluetooth size={17} />
                {t('Caută dispozitive auto asociate', 'Find paired car devices')}
              </button>
              {devices?.length === 0 && (
                <p role="status">
                  {t(
                    'Android nu a raportat dispozitive audio auto asociate. Verifică setările Bluetooth.',
                    'Android found no paired car audio devices. Check Bluetooth settings.',
                  )}
                </p>
              )}
              {!!devices?.length && (
                <label>
                  {t('Dispozitiv auto', 'Car device')}
                  <select
                    value={device}
                    disabled={busy}
                    onChange={(event) => setDevice(event.target.value)}
                  >
                    <option value="">{t('Alege dispozitivul', 'Choose device')}</option>
                    {devices.map((item) => (
                      <option key={item.address} value={item.address} data-user-content>
                        {item.name} · {item.address}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="primary"
                disabled={busy || !car || !device}
                onClick={() =>
                  void act(async () => {
                    if (!car || !device) return;
                    await nativeAutomation.configure({
                      ownerId,
                      vehicleId: car.id,
                      vehicleName: car.brand + ' ' + car.model,
                      baseline: car.odometer,
                      address: device,
                    });
                    setConnection(null);
                    await reload();
                    setNotice(t('Asocierea a fost salvată.', 'Pairing saved.'));
                  })
                }
              >
                {t('Asociază automobilul', 'Pair vehicle')}
              </button>
            </>
          )}
        </section>
        <section>
          <h4>
            <Radio size={18} /> {t('Dispozitive și conexiune', 'Devices and connection')}
          </h4>
          {bindings.length ? (
            <ul className="ac-bluetooth-devices">
              {bindings.map((item) => (
                <li key={item.vehicleId}>
                  <button
                    type="button"
                    aria-pressed={item.vehicleId === carId}
                    onClick={() => chooseVehicle(item.vehicleId)}
                  >
                    <Bluetooth size={16} />
                    <span data-user-content>
                      {item.vehicleName}
                      <small>{item.address}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {t(
                'Nu există sisteme audio auto asociate în AutoCare.',
                'There are no car audio systems paired in AutoCare.',
              )}
            </p>
          )}
          {binding && (
            <>
              <div className="ac-bluetooth-status" role="status">
                <BluetoothConnected size={18} />
                <span>
                  {live
                    ? connectionLabels[live.state]
                    : canCheckConnection
                      ? t('Se verifică legătura audio', 'Checking car audio')
                      : t(
                          'Actualizează APK-ul pentru starea live',
                          'Update the APK for live status',
                        )}
                  {live?.name && <small data-user-content>{live.name}</small>}
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await nativeAutomation.disable(ownerId, binding.vehicleId);
                    setConnection(null);
                    await reload();
                  })
                }
              >
                {t('Elimină asocierea', 'Remove pairing')}
              </button>
            </>
          )}
          {canCheckConnection && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(nativeAutomation.openBluetoothSettings)}
            >
              <Settings2 size={17} />
              {t('Reconectează din setările Bluetooth', 'Reconnect in Bluetooth settings')}
            </button>
          )}
          {supported && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(nativeAutomation.openSettings)}
            >
              {t('Permisiunile telefonului', 'Phone permissions')}
            </button>
          )}
        </section>
      </div>
      {pending.length > 0 && (
        <div className="ac-auto-pending">
          <h4>
            {t('Trasee în așteptarea sincronizării', 'Trips waiting to sync')} · {pending.length}
          </h4>
          <button type="button" disabled={busy} onClick={() => void act(() => sync())}>
            {t('Reîncearcă sincronizarea', 'Retry sync')}
          </button>
          {carId && pending.some((trip) => trip.vehicleId === carId) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      'Salvezi aceste trasee fără să adaugi kilometri?',
                      'Save these trips without adding mileage?',
                    ),
                  )
                )
                  void act(() => sync(carId));
              }}
            >
              {t('Salvează traseele fără a adăuga kilometri', 'Save trips without adding mileage')}
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
