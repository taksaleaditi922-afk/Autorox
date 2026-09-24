// ---------------------------------------------------------------------------
// Tests for the vehicle registry adapter.
//
// The provider is stubbed with `fetch`, so nothing here touches the network.
// The normalisation cases mirror the payloads of the providers we support
// (Surepass/Cashfree/Signzy/Vahan style), which is the part most likely to
// break when a provider changes its field names.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flattenPayload,
  inferVehicleType,
  normalizeFuelType,
  normalizeRegistryPayload,
  parseYear,
} from './vehicleRegistry.js';

const ENV_KEYS = [
  'VEHICLE_REGISTRY_URL',
  'VEHICLE_REGISTRY_KEY',
  'VEHICLE_REGISTRY_METHOD',
  'VEHICLE_REGISTRY_AUTH_STYLE',
  'VEHICLE_REGISTRY_PARAM',
  'VEHICLE_REGISTRY_TIMEOUT_MS',
  'VEHICLE_REGISTRY_CACHE_TTL_SECONDS',
];

let savedEnv: Record<string, string | undefined> = {};

function setEnv(values: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

/** env.ts reads process.env at import time, so the module is re-imported. */
async function loadRegistryModule() {
  vi.resetModules();
  return import('./vehicleRegistry.js');
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeRegistryPayload', () => {
  it('reads a Vahan-style nested payload', () => {
    const vehicle = normalizeRegistryPayload(
      {
        status: 'success',
        data: {
          client_id: 'MH12AB1234',
          vehicle_manufacturer_name: 'MARUTI SUZUKI',
          vehicle_model: 'SWIFT VXI',
          vehicle_chasi_number: 'ma3abc123456789',
          vehicle_engine_number: 'k12mn1234567',
          fuel_type: 'PETROL',
          vehicle_manufacturing_month_year: '05/2020',
          vehicle_category_description: 'LMV',
        },
      },
      'MH12AB1234'
    );

    expect(vehicle).toEqual({
      registrationNumber: 'MH12AB1234',
      make: 'MARUTI SUZUKI',
      model: 'SWIFT VXI',
      variant: '',
      year: 2020,
      color: '',
      fuelType: 'Petrol',
      vin: 'MA3ABC123456789',
      engineNumber: 'K12MN1234567',
      vehicleType: '4W',
    });
  });

  it('reads a flat, snake-cased payload', () => {
    const vehicle = normalizeRegistryPayload(
      {
        rc_number: 'DL8CAF5030',
        brand: 'Hyundai',
        model: 'i20',
        variant: 'Asta',
        fuel: 'Diesel',
        colour: 'Polar White',
        chassis_no: 'malbb51cldm123456',
        engine_no: 'd4fa1234567',
        class: 'Motor Cycle',
      },
      'DL8CAF5030',
    );

    expect(vehicle).toMatchObject({
      registrationNumber: 'DL8CAF5030',
      make: 'Hyundai',
      model: 'i20',
      variant: 'Asta',
      color: 'Polar White',
      fuelType: 'Diesel',
      vin: 'MALBB51CLDM123456',
      vehicleType: '2W',
    });
  });

  it('falls back to the requested number and empty strings when the payload says nothing', () => {
    const vehicle = normalizeRegistryPayload({ status: 'error', message: 'not found' }, 'MH12AB1234');
    expect(vehicle).toEqual({
      registrationNumber: 'MH12AB1234',
      make: '',
      model: '',
      variant: '',
      year: undefined,
      color: '',
      fuelType: '',
      vin: '',
      engineNumber: '',
      vehicleType: '',
    });
  });

  it('prefers a top-level field over a nested duplicate', () => {
    expect(normalizeRegistryPayload({ make: 'Tata', data: { make: 'Mahindra' } }, 'MH12AB1234').make).toBe('Tata');
  });

  it('stops descending past the depth limit and ignores arrays of scalars', () => {
    const flat = flattenPayload({
      make: 'Kia',
      warnings: ['x'],
      a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } },
    });
    expect(flat.make).toBe('Kia');
    expect(flat.g).toBeUndefined();
  });
});

describe('field helpers', () => {
  it('extracts a manufacturing year from the formats providers use', () => {
    expect(parseYear(2021)).toBe(2021);
    expect(parseYear('2021')).toBe(2021);
    expect(parseYear('05/2020')).toBe(2020);
    expect(parseYear('2020-05-01')).toBe(2020);
    expect(parseYear('')).toBeUndefined();
    expect(parseYear('unknown')).toBeUndefined();
    expect(parseYear('1850')).toBeUndefined();
  });

  it('maps free-text fuel values onto the workshop fuel list', () => {
    expect(normalizeFuelType('PETROL')).toBe('Petrol');
    expect(normalizeFuelType('Diesel (Turbo)')).toBe('Diesel');
    expect(normalizeFuelType('CNG')).toBe('CNG');
    expect(normalizeFuelType('PETROL/CNG')).toBe('CNG');
    expect(normalizeFuelType('Battery')).toBe('Electric');
    expect(normalizeFuelType('Strong Hybrid')).toBe('Hybrid');
    expect(normalizeFuelType('Kerosene')).toBe('Other');
    expect(normalizeFuelType('')).toBe('');
  });

  it('infers the vehicle type from the registration class', () => {
    expect(inferVehicleType('MOTOR CYCLE')).toBe('2W');
    expect(inferVehicleType('MCWG')).toBe('2W');
    expect(inferVehicleType('LMV')).toBe('4W');
    expect(inferVehicleType('')).toBe('');
    expect(inferVehicleType('Something else')).toBe('');
  });
});

describe('registry lookup', () => {
  it('reports that no provider is configured', async () => {
    setEnv({});
    const registry = await loadRegistryModule();

    expect(registry.isRegistryConfigured()).toBe(false);
    await expect(registry.lookupVehicleInRegistry('MH12AB1234')).rejects.toBeInstanceOf(
      registry.RegistryNotConfiguredError
    );
  });

  it('calls the provider once, normalises the answer and serves the next lookup from cache', async () => {
    setEnv({
      VEHICLE_REGISTRY_URL: 'https://registry.test/rc/{reg}',
      VEHICLE_REGISTRY_KEY: 'test-key',
      VEHICLE_REGISTRY_AUTH_STYLE: 'bearer',
    });
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            vehicle_number: 'MH12AB1234',
            vehicle_manufacturer_name: 'Maruti Suzuki',
            vehicle_model: 'Swift',
            fuel_type: 'PETROL',
            vehicle_manufacturing_month_year: '05/2020',
            vehicle_chasi_number: 'ma3abc123456789',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const registry = await loadRegistryModule();

    const first = await registry.lookupVehicleInRegistry('MH 12 AB 1234');
    expect(first.source).toBe('registry');
    expect(first.vehicle).toMatchObject({
      registrationNumber: 'MH12AB1234',
      make: 'Maruti Suzuki',
      model: 'Swift',
      fuelType: 'Petrol',
      year: 2020,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('https://registry.test/rc/MH12AB1234');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const second = await registry.lookupVehicleInRegistry('MH12AB1234');
    expect(second.source).toBe('cache');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts the registration number with a custom field name', async () => {
    setEnv({
      VEHICLE_REGISTRY_URL: 'https://registry.test/api/v1/vehicle/rc',
      VEHICLE_REGISTRY_METHOD: 'POST',
      VEHICLE_REGISTRY_PARAM: 'id_number',
      VEHICLE_REGISTRY_KEY: 'test-key',
      VEHICLE_REGISTRY_AUTH_STYLE: 'x-api-key',
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { make: 'Tata', model: 'Nexon' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const registry = await loadRegistryModule();

    await registry.lookupVehicleInRegistry('MH12AB1234');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('https://registry.test/api/v1/vehicle/rc');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ id_number: 'MH12AB1234' });
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
  });

  it('turns a provider 404 into a not-found error', async () => {
    setEnv({ VEHICLE_REGISTRY_URL: 'https://registry.test/rc/{reg}' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const registry = await loadRegistryModule();

    await expect(registry.lookupVehicleInRegistry('MH12AB1234')).rejects.toBeInstanceOf(registry.RegistryNotFoundError);
  });

  it('treats an empty 200 response as a miss instead of a vehicle', async () => {
    setEnv({ VEHICLE_REGISTRY_URL: 'https://registry.test/rc/{reg}' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })));
    const registry = await loadRegistryModule();

    await expect(registry.lookupVehicleInRegistry('MH12AB1234')).rejects.toBeInstanceOf(registry.RegistryNotFoundError);
  });

  it('wraps transport failures and rejections as unavailable', async () => {
    setEnv({ VEHICLE_REGISTRY_URL: 'https://registry.test/rc/{reg}' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const failing = await loadRegistryModule();
    await expect(failing.lookupVehicleInRegistry('MH12AB1234')).rejects.toBeInstanceOf(failing.RegistryUnavailableError);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      })
    );
    const offline = await loadRegistryModule();
    await expect(offline.lookupVehicleInRegistry('MH12AB1234')).rejects.toBeInstanceOf(offline.RegistryUnavailableError);
  });

  it('gives up on an unresponsive provider instead of hanging the request', async () => {
    setEnv({ VEHICLE_REGISTRY_URL: 'https://registry.test/rc/{reg}', VEHICLE_REGISTRY_TIMEOUT_MS: '20' });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const abortError = new Error('aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          })
      )
    );
    const registry = await loadRegistryModule();

    await expect(registry.lookupVehicleInRegistry('MH12AB1234')).rejects.toBeInstanceOf(registry.RegistryUnavailableError);
  });
});
