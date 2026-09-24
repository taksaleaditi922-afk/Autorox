// ---------------------------------------------------------------------------
// Vehicle registry adapter (RC lookup).
//
// Given a registration number, asks the provider configured in the environment
// and normalises the answer into the shape this app stores.
//
// Providers disagree about field names — `make` vs `vehicle_make` vs
// `manufacturer_name`, `chassis` vs `vehicle_chasi_number` — so rather than one
// adapter per vendor, the response is flattened and read through alias lists.
// A new provider is a configuration change, not a code change.
//
// Remote responses are cached in memory (see VEHICLE_REGISTRY_CACHE_TTL_SECONDS)
// and concurrent requests for the same number share one upstream call: RC data
// is near-static, and paid providers bill per lookup.
// ---------------------------------------------------------------------------

import env from '../config/env.js';

export interface RegistryVehicle {
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  year?: number;
  color: string;
  fuelType: string;
  vin: string;
  engineNumber: string;
  vehicleType: '2W' | '4W' | '';
}

export class RegistryNotConfiguredError extends Error {
  constructor(message = 'No vehicle registry provider is configured.') {
    super(message);
    this.name = 'RegistryNotConfiguredError';
  }
}

export class RegistryNotFoundError extends Error {
  constructor(message = 'No registry record was found for this number.') {
    super(message);
    this.name = 'RegistryNotFoundError';
  }
}

export class RegistryUnavailableError extends Error {
  constructor(message = 'The vehicle registry is unavailable right now.') {
    super(message);
    this.name = 'RegistryUnavailableError';
  }
}

// ---------------------------------------------------------------------------
// Response normalisation
// ---------------------------------------------------------------------------

/** Alias lists are already stripped to lowercase alphanumerics. */
const ALIASES = {
  registrationNumber: [
    'registrationnumber',
    'registrationno',
    'regnumber',
    'regno',
    'vehicleregistrationnumber',
    'vehiclenumber',
    'rcnumber',
    'vahanregno',
  ],
  make: [
    'make',
    'brand',
    'manufacturer',
    'manufacturername',
    'vehiclemanufacturer',
    'vehiclemanufacturername',
    'vehiclemake',
    'vehiclemakername',
    'carmake',
    'maker',
  ],
  model: ['model', 'vehiclemodel', 'modelname', 'vehiclemodelname', 'carmodel'],
  variant: ['variant', 'vehiclevariant', 'variantname'],
  year: [
    'year',
    'manufacturingyear',
    'vehiclemanufacturingyear',
    'vehicleyear',
    'modelyear',
    'manufactureyear',
    'registrationyear',
    'vehiclemanufacturingmonthyear',
    'yom',
  ],
  color: ['color', 'colour', 'vehiclecolor', 'vehiclecolour'],
  fuelType: ['fueltype', 'fuel', 'vehiclefueltype', 'fueldescription', 'vehiclefueldescription', 'fuelname'],
  vin: [
    'vin',
    'chassisnumber',
    'vehchassisnumber',
    'vehiclechassisnumber',
    'vehichechassisnumber',
    'vehiclechassinumber',
    'vehiclechasinumber',
    'chassis',
    'chassisno',
    'vehiclevin',
  ],
  engineNumber: ['enginenumber', 'engineno', 'vehicleenginenumber', 'engine'],
  vehicleClass: ['vehicletype', 'vehicleclass', 'vehiclecategory', 'class', 'bodytype', 'vehiclecategorydescription'],
} as const;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Flatten a (possibly nested) payload into one map of normalized key -> scalar. */
export function flattenPayload(payload: unknown, out: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || depth > 5) return out;
  if (Array.isArray(payload)) {
    for (const entry of payload) flattenPayload(entry, out, depth + 1);
    return out;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') {
      flattenPayload(value, out, depth + 1);
      continue;
    }
    const normalized = normalizeKey(key);
    // First value wins, so a top-level field beats a nested duplicate.
    if (!(normalized in out)) out[normalized] = value;
  }
  return out;
}

function firstValue(flat: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    const value = flat[alias];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Accepts 2020, "2020", "05/2020", "2020-05-01", "2020-05". */
export function parseYear(value: unknown): number | undefined {
  const text = asText(value);
  if (!text) return undefined;
  const match = text.match(/(19|20)\d{2}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  return year >= 1900 && year <= new Date().getFullYear() + 1 ? year : undefined;
}

const FUEL_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /electric|\bev\b|battery/, value: 'Electric' },
  { pattern: /hybrid/, value: 'Hybrid' },
  { pattern: /cng|lpg/, value: 'CNG' },
  { pattern: /diesel/, value: 'Diesel' },
  { pattern: /petrol|gasoline/, value: 'Petrol' },
];

/** Map a provider's free-text fuel value onto the workshop's fuel list. */
export function normalizeFuelType(value: unknown): string {
  const text = asText(value).toLowerCase();
  if (!text) return '';
  return FUEL_PATTERNS.find((entry) => entry.pattern.test(text))?.value || 'Other';
}

/** Vahan reports classes such as "MOTOR CYCLE", "LMV", "MCWG", "HGV". */
export function inferVehicleType(value: unknown): '2W' | '4W' | '' {
  const text = asText(value).toLowerCase();
  if (!text) return '';
  if (/two wheeler|2w|motor ?cycle|motorcycle|scooter|moped|mcwg|mcy|bike/.test(text)) return '2W';
  if (/four wheeler|4w|car|lmv|passenger|hmv|hgv|goods|bus|taxi/.test(text)) return '4W';
  return '';
}

export function normalizeRegistration(value: string): string {
  return asText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Turn any provider payload into the canonical vehicle record. Unknown fields
 * come back as empty strings so the UI always receives the same shape.
 */
export function normalizeRegistryPayload(payload: unknown, registrationNumber: string): RegistryVehicle {
  const flat = flattenPayload(payload);
  return {
    registrationNumber: normalizeRegistration(asText(firstValue(flat, ALIASES.registrationNumber)) || registrationNumber),
    make: asText(firstValue(flat, ALIASES.make)),
    model: asText(firstValue(flat, ALIASES.model)),
    variant: asText(firstValue(flat, ALIASES.variant)),
    year: parseYear(firstValue(flat, ALIASES.year)),
    color: asText(firstValue(flat, ALIASES.color)),
    fuelType: normalizeFuelType(firstValue(flat, ALIASES.fuelType)),
    vin: asText(firstValue(flat, ALIASES.vin)).toUpperCase(),
    engineNumber: asText(firstValue(flat, ALIASES.engineNumber)).toUpperCase(),
    vehicleType: inferVehicleType(firstValue(flat, ALIASES.vehicleClass)),
  };
}

// ---------------------------------------------------------------------------
// Upstream request
// ---------------------------------------------------------------------------

export function isRegistryConfigured(): boolean {
  return Boolean(env.vehicleRegistry.url);
}

function buildRequest(reg: string): { url: string; init: RequestInit } {
  const { url, key, method, authStyle, authHeader, keyParam, clientId, clientSecret, param } = env.vehicleRegistry;

  let target = url.includes('{reg}') ? url.replace(/\{reg\}/g, encodeURIComponent(reg)) : url;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (authStyle === 'bearer' && key) {
    headers.Authorization = `Bearer ${key}`;
  } else if (authStyle === 'x-api-key' && key) {
    headers[authHeader] = key;
  } else if (authStyle === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else if (authStyle === 'query' && key) {
    target += `${target.includes('?') ? '&' : '?'}${encodeURIComponent(keyParam)}=${encodeURIComponent(key)}`;
  }

  if (!url.includes('{reg}') && method === 'GET') {
    target += `${target.includes('?') ? '&' : '?'}${encodeURIComponent(param)}=${encodeURIComponent(reg)}`;
  }

  const init: RequestInit = { method, headers };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ [param]: reg });
  }
  return { url: target, init };
}

async function requestRegistry(reg: string): Promise<RegistryVehicle> {
  const { timeoutMs } = env.vehicleRegistry;
  const { url, init } = buildRequest(reg);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (response.status === 404 || response.status === 422) {
      throw new RegistryNotFoundError(`No registry record was found for ${reg}.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new RegistryUnavailableError('The vehicle registry rejected our credentials.');
    }
    if (!response.ok) {
      throw new RegistryUnavailableError(`The vehicle registry responded with status ${response.status}.`);
    }

    const payload = await response.json().catch(() => null);
    const vehicle = normalizeRegistryPayload(payload, reg);
    // A 200 with nothing usable in it is a miss, not a vehicle.
    if (!vehicle.make && !vehicle.model) {
      throw new RegistryNotFoundError(`No registry record was found for ${reg}.`);
    }
    return vehicle;
  } catch (err: any) {
    if (err instanceof RegistryNotFoundError || err instanceof RegistryUnavailableError) throw err;
    if (err?.name === 'AbortError') {
      throw new RegistryUnavailableError(`The vehicle registry did not respond within ${timeoutMs}ms.`);
    }
    throw new RegistryUnavailableError(`Could not reach the vehicle registry: ${err?.message || 'unknown error'}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_LIMIT = 500;
const cache = new Map<string, { vehicle: RegistryVehicle; at: number }>();
const inFlight = new Map<string, Promise<RegistryVehicle>>();

function readCache(reg: string): RegistryVehicle | null {
  const entry = cache.get(reg);
  if (!entry) return null;
  if (Date.now() - entry.at > env.vehicleRegistry.cacheTtlSeconds * 1000) {
    cache.delete(reg);
    return null;
  }
  return entry.vehicle;
}

function writeCache(reg: string, vehicle: RegistryVehicle): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(reg, { vehicle, at: Date.now() });
}

/** Test helper / manual invalidation point. */
export function clearRegistryCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * Look a registration number up in the configured registry.
 * Throws RegistryNotConfiguredError, RegistryNotFoundError or
 * RegistryUnavailableError — callers turn those into API responses.
 */
export async function lookupVehicleInRegistry(
  registrationNumber: string
): Promise<{ vehicle: RegistryVehicle; source: 'registry' | 'cache' }> {
  if (!isRegistryConfigured()) throw new RegistryNotConfiguredError();

  const reg = normalizeRegistration(registrationNumber);
  const cached = readCache(reg);
  if (cached) return { vehicle: cached, source: 'cache' };

  // Share one upstream call between concurrent advisors. The shared request is
  // deliberately not tied to any single caller's abort signal.
  let pending = inFlight.get(reg);
  if (!pending) {
    pending = requestRegistry(reg)
      .then((vehicle) => {
        writeCache(reg, vehicle);
        return vehicle;
      })
      .finally(() => {
        inFlight.delete(reg);
      });
    inFlight.set(reg, pending);
  }

  return { vehicle: await pending, source: 'registry' };
}
