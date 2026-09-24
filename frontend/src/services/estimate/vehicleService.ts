// ---------------------------------------------------------------------------
// Vehicle service — the UI never calls a registry API directly.
//
// Resolution order:
//   1. GET /api/vehicles/lookup/:regNo — the workshop's own vehicle master,
//      then the registry provider configured on the SERVER. Keeping the
//      provider call server-side means the API key never reaches the browser,
//      and every advisor shares one cached result per registration number.
//   2. the built-in offline adapter, used only when no registry is configured
//      (so the workflow is fully demoable end to end)
// Manual entry always remains available when both steps fail.
// ---------------------------------------------------------------------------

import api from '../api';
import type { FuelType, Vehicle } from './types';

export interface VehicleLookupResult {
  vehicle: Partial<Vehicle>;
  /** Where the data came from, so the UI can label it honestly. */
  source: 'workshop' | 'provider' | 'cache' | 'manual';
  messages?: string[];
}

export interface VehicleLookupProvider {
  name: string;
  lookup(registrationNumber: string, signal?: AbortSignal): Promise<Partial<Vehicle>>;
}

const FUEL_TYPES: FuelType[] = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'Other'];

/**
 * Deterministic offline adapter. Given the same registration number it always
 * returns the same vehicle, which keeps demos and tests reproducible. It is
 * only used when the server has no registry provider configured.
 */
export class OfflineRegistryProvider implements VehicleLookupProvider {
  name = 'offline-registry';

  private hash(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) {
      h = (h * 31 + value.charCodeAt(i)) % 100000;
    }
    return h;
  }

  async lookup(registrationNumber: string): Promise<Partial<Vehicle>> {
    const reg = registrationNumber.toUpperCase().replace(/\s+/g, '');
    const h = this.hash(reg);
    const models: { brand: string; model: string; variant: string }[] = [
      { brand: 'Maruti Suzuki', model: 'Swift', variant: 'VXi' },
      { brand: 'Hyundai', model: 'i20', variant: 'Asta' },
      { brand: 'Tata', model: 'Nexon', variant: 'XZ+' },
      { brand: 'Mahindra', model: 'XUV300', variant: 'W8' },
      { brand: 'Honda', model: 'City', variant: 'ZX' },
      { brand: 'Toyota', model: 'Innova Crysta', variant: 'GX' },
      { brand: 'Kia', model: 'Seltos', variant: 'HTX' },
    ];
    const pick = models[h % models.length];
    const year = 2015 + (h % 11);
    const fuelType = FUEL_TYPES[h % 4];
    const isTwoWheeler = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(reg) && h % 7 === 0;

    return {
      type: isTwoWheeler ? '2W' : '4W',
      registrationNumber: reg,
      brand: isTwoWheeler ? (h % 2 === 0 ? 'Hero' : 'Bajaj') : pick.brand,
      model: isTwoWheeler ? (h % 2 === 0 ? 'Splendor Plus' : 'Pulsar 150') : pick.model,
      variant: isTwoWheeler ? 'Standard' : pick.variant,
      year,
      fuelType,
      color: ['Pearl White', 'Midnight Black', 'Titanium Grey', 'Fiery Red', 'Silver'][h % 5],
      engineNumber: `ENG${(h * 7919).toString().padStart(10, '0').slice(0, 10)}`,
      chassisNumber: `MA3${reg.slice(-6)}${(h * 104729).toString().padStart(8, '0').slice(0, 8)}`,
      odometer: 8000 + (h % 90) * 1000,
      fuelMeter: 15 + (h % 70),
      evBatteryCapacity: fuelType === 'Electric' ? '26.8 kWh' : '',
      evChargerType: fuelType === 'Electric' ? 'Type 2 AC / CCS2 DC' : '',
    };
  }
}

let provider: VehicleLookupProvider = new OfflineRegistryProvider();

export function setVehicleLookupProvider(next: VehicleLookupProvider): void {
  provider = next;
}

export function getVehicleLookupProvider(): VehicleLookupProvider {
  return provider;
}

/** Normalise an Indian registration number: MH 12 AB 1234 -> MH12AB1234. */
export function normalizeRegistration(value: string): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isPlausibleRegistration(value: string): boolean {
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(value);
}

const FUEL_ALIASES: { match: RegExp; value: FuelType }[] = [
  { match: /electric|\bev\b|battery/, value: 'Electric' },
  { match: /hybrid/, value: 'Hybrid' },
  { match: /cng|lpg/, value: 'CNG' },
  { match: /diesel/, value: 'Diesel' },
  { match: /petrol|gasoline/, value: 'Petrol' },
];

function mapFuelType(value: unknown): FuelType | '' {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return '';
  const exact = FUEL_TYPES.find((fuel) => fuel.toLowerCase() === raw);
  if (exact) return exact;
  return FUEL_ALIASES.find((alias) => alias.match.test(raw))?.value || 'Other';
}

/**
 * Map a vehicle record — from the workshop master or the registry provider —
 * onto the estimate Vehicle shape. Both sides use the same canonical keys so
 * one mapper covers them.
 */
function mapRegistryVehicle(doc: any): Partial<Vehicle> {
  return {
    // Omitted rather than set to undefined: the reducer spreads the patch, so a
    // present key with no value would erase a known vehicle id.
    ...(doc._id || doc.id ? { id: doc._id || doc.id } : {}),
    registrationNumber: doc.registrationNumber || '',
    brand: doc.make || doc.brand || '',
    model: doc.model || '',
    variant: doc.variant || '',
    year: doc.year || '',
    color: doc.color || '',
    fuelType: mapFuelType(doc.fuelType),
    engineNumber: doc.engineNumber || '',
    chassisNumber: doc.vin || doc.chassisNumber || '',
    odometer: doc.odometerReading ?? doc.odometer ?? '',
    // Only overwrite the vehicle type when the source actually knows it.
    ...(doc.vehicleType === '2W' || doc.vehicleType === '4W' ? { type: doc.vehicleType } : {}),
  };
}

/**
 * fetchVehicle(registrationNumber)
 * Never throws for "not found" — instead returns source: 'manual' so the form
 * can tell the user to fill the details in by hand.
 */
export async function fetchVehicle(
  registrationNumber: string,
  signal?: AbortSignal
): Promise<VehicleLookupResult> {
  const reg = normalizeRegistration(registrationNumber);
  if (!reg) throw new Error('Enter a registration number to fetch vehicle details');
  if (!isPlausibleRegistration(reg)) {
    throw new Error('Enter a valid registration number, e.g. MH12AB1234');
  }

  const messages: string[] = [];

  // 1. Server-side lookup: workshop master first, then the registry provider.
  try {
    const res = await api.get(`/vehicles/lookup/${encodeURIComponent(reg)}`, { signal });
    const payload = res.data?.data;
    if (payload?.vehicle) {
      return {
        vehicle: { ...mapRegistryVehicle(payload.vehicle), registrationNumber: reg },
        source: payload.source === 'workshop' ? 'workshop' : payload.source === 'cache' ? 'cache' : 'provider',
        messages,
      };
    }
  } catch (err: any) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;

    const code = err?.response?.data?.code;
    const detail = err?.response?.data?.error;

    if (code === 'NOT_FOUND') {
      return {
        vehicle: { registrationNumber: reg },
        source: 'manual',
        messages: [detail || 'No registry record was found for this number. Enter the details manually.'],
      };
    }
    if (code === 'UNAVAILABLE') {
      return {
        vehicle: { registrationNumber: reg },
        source: 'manual',
        messages: [detail || 'The vehicle registry is not responding right now. Enter the details manually.'],
      };
    }
    // REGISTRY_NOT_CONFIGURED (and anything unexpected) falls through to the
    // built-in adapter so the workflow still works without credentials.
    if (code !== 'REGISTRY_NOT_CONFIGURED') {
      messages.push('The vehicle registry could not be reached.');
    }
  }

  // 2. Built-in adapter — demo/offline data only.
  try {
    const partial = await provider.lookup(reg, signal);
    return { vehicle: { ...partial, registrationNumber: reg }, source: 'provider', messages };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    messages.push('Unable to fetch vehicle details.');
    return { vehicle: { registrationNumber: reg }, source: 'manual', messages };
  }
}

export async function saveVehicle(vehicle: Vehicle): Promise<Vehicle> {
  const payload = {
    registrationNumber: normalizeRegistration(vehicle.registrationNumber),
    make: vehicle.brand,
    model: vehicle.model,
    year: Number(vehicle.year) || undefined,
    color: vehicle.color,
    fuelType: vehicle.fuelType || undefined,
    vin: vehicle.chassisNumber,
    odometerReading: vehicle.odometer === '' ? undefined : Number(vehicle.odometer),
  };
  try {
    if (vehicle.id) {
      const res = await api.put(`/vehicles/${vehicle.id}`, payload);
      return mapRegistryVehicle(res.data?.data) as Vehicle;
    }
    const res = await api.post('/vehicles', payload);
    return mapRegistryVehicle(res.data?.data) as Vehicle;
  } catch (err: any) {
    // Persisting the vehicle master is best-effort; the estimate itself can
    // still be saved with the vehicle details embedded.
    throw new Error(err?.response?.data?.error || 'Could not save the vehicle to the master list');
  }
}

export default { fetchVehicle, saveVehicle, setVehicleLookupProvider, getVehicleLookupProvider, normalizeRegistration };
