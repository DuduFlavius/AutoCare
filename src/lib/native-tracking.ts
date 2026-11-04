import { Capacitor, registerPlugin } from '@capacitor/core';
import { z } from 'zod';
import type { GPSFix } from './gps-tracking';
/** Native service owns the distance; JavaScript only reads snapshots. */
export type NativeTrip = {
  id: string;
  ownerId: string;
  vehicleId: string;
  baseline: number;
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  lastFixAt?: number;
  distance: number;
  active: boolean;
  automatic?: boolean;
  points: GPSFix[];
};
interface TrackingPlugin {
  start(input: {
    id: string;
    ownerId: string;
    vehicleId: string;
    baseline: number;
  }): Promise<unknown>;
  snapshot(input: { ownerId: string }): Promise<unknown>;
  stop(input: { ownerId: string }): Promise<unknown>;
  clear(input: { ownerId: string }): Promise<void>;
  automationStatus(input: { ownerId: string }): Promise<unknown>;
  pairedDevices(input: {
    ownerId: string;
  }): Promise<{ devices: { name: string; address: string }[] }>;
  configureAutomation(input: {
    ownerId: string;
    vehicleId: string;
    vehicleName: string;
    baseline: number;
    address?: string;
  }): Promise<unknown>;
  disableAutomation(input: { ownerId: string; vehicleId?: string }): Promise<void>;
  openLocationSettings(): Promise<void>;
  pendingTrips(input: { ownerId: string }): Promise<{ trips: unknown[] }>;
  acknowledgeTrips(input: { ownerId: string; ids: string[] }): Promise<void>;
  updateAutomationVehicle(input: {
    ownerId: string;
    vehicleId: string;
    baseline: number;
  }): Promise<void>;
}
const plugin = registerPlugin<TrackingPlugin>('AutoCareTracking');
const point = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  timestamp: z.number().positive(),
  breakBefore: z.boolean().optional(),
});
const trip = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1),
  vehicleId: z.string().min(1),
  baseline: z.number().int().nonnegative(),
  startedAt: z.number().positive(),
  updatedAt: z.number().positive(),
  endedAt: z.number().positive().optional(),
  lastFixAt: z.number().nonnegative().optional(),
  distance: z.number().nonnegative(),
  active: z.boolean(),
  automatic: z.boolean().optional(),
  points: z.array(point).max(1500),
});
export function readNativeTrip(value: unknown, ownerId: string): NativeTrip | null {
  const result = trip.safeParse(value);
  return result.success && result.data.ownerId === ownerId ? result.data : null;
}
export function hasNativeTracking() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AutoCareTracking');
}
export const nativeTracking = {
  async snapshot(ownerId: string) {
    return readNativeTrip(await plugin.snapshot({ ownerId }), ownerId);
  },
  async start(input: { id: string; ownerId: string; vehicleId: string; baseline: number }) {
    const value = readNativeTrip(await plugin.start(input), input.ownerId);
    if (!value) throw Error('Nu s-a putut porni urmărirea GPS.');
    return value;
  },
  async stop(ownerId: string) {
    return readNativeTrip(await plugin.stop({ ownerId }), ownerId);
  },
  async clear(ownerId: string) {
    await plugin.clear({ ownerId });
  },
};

export type AutoBinding = {
  ownerId: string;
  vehicleId: string;
  vehicleName: string;
  baseline: number;
  enabled: boolean;
  address?: string;
};
export type AutoStatus = {
  apiVersion: number;
  platform: 'android' | 'ios';
  supported: boolean;
  bindings: AutoBinding[];
  pendingCount: number;
  backgroundLocation: boolean;
  error: string;
};
export function nativeMethodMissing(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return (
    value?.code === 'UNIMPLEMENTED' ||
    /not implemented|does not exist|not available/i.test(value?.message || '')
  );
}
export const nativeAutomation = {
  async status(ownerId: string) {
    return (await plugin.automationStatus({ ownerId })) as AutoStatus;
  },
  async devices(ownerId: string) {
    return (await plugin.pairedDevices({ ownerId })).devices;
  },
  async configure(input: {
    ownerId: string;
    vehicleId: string;
    vehicleName: string;
    baseline: number;
    address?: string;
  }) {
    return (await plugin.configureAutomation(input)) as AutoStatus;
  },
  async disable(ownerId: string, vehicleId?: string) {
    await plugin.disableAutomation({ ownerId, vehicleId });
  },
  async openSettings() {
    await plugin.openLocationSettings();
  },
  async pending(ownerId: string) {
    const result = await plugin.pendingTrips({ ownerId });
    if (!Array.isArray(result.trips)) throw Error('Invalid native trip queue');
    const parsed = result.trips.map((t) => readNativeTrip(t, ownerId));
    if (parsed.some((t) => !t || t.active || !t.automatic || !t.endedAt))
      throw Error('Invalid native trip queue');
    return parsed as NativeTrip[];
  },
  async acknowledge(ownerId: string, ids: string[]) {
    await plugin.acknowledgeTrips({ ownerId, ids });
  },
  async updateVehicle(ownerId: string, vehicleId: string, baseline: number) {
    await plugin.updateAutomationVehicle({ ownerId, vehicleId, baseline });
  },
  async signOut(ownerId: string) {
    try {
      await plugin.disableAutomation({ ownerId });
    } catch (e) {
      if (!nativeMethodMissing(e)) throw e;
    }
    await plugin.stop({ ownerId });
  },
};
