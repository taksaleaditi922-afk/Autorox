// ---------------------------------------------------------------------------
// Catalog service — services, packages, parts and labour.
//
// Tries the server first (/api/estimates/catalog/*) and falls back to the
// bundled catalog so the estimate builder works before the catalog is
// populated. Filtering/sorting/pagination behaviour is identical either way,
// so swapping in the real endpoints changes nothing in the UI.
// ---------------------------------------------------------------------------

import api from '../api';
import {
  DEFAULT_BUSINESS_CONFIG,
  LABOUR_CATALOG,
  PACKAGE_CATALOG,
  PART_CATALOG,
  SERVICE_CATALOG,
} from './config';
import type {
  CatalogFilters,
  CatalogLabour,
  CatalogPage,
  CatalogPackage,
  CatalogPart,
  CatalogService,
  EstimateBusinessConfig,
  VehicleType,
} from './types';

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  page: 1,
  limit: 10,
};

function paginate<T>(items: T[], page: number, limit: number): CatalogPage<T> {
  const safeLimit = Math.max(1, limit || 10);
  const safePage = Math.max(1, page || 1);
  const start = (safePage - 1) * safeLimit;
  return {
    data: items.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / safeLimit)),
    },
  };
}

function matchesText(haystack: (string | undefined)[], needle: string): boolean {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((h) => (h || '').toLowerCase().includes(q));
}

function inPriceRange(price: number, filters: CatalogFilters): boolean {
  const min = filters.minPrice === '' ? null : Number(filters.minPrice);
  const max = filters.maxPrice === '' ? null : Number(filters.maxPrice);
  if (min !== null && Number.isFinite(min) && price < min) return false;
  if (max !== null && Number.isFinite(max) && price > max) return false;
  return true;
}

function forVehicleType(types: VehicleType[] | undefined, vehicleType?: VehicleType): boolean {
  if (!types || !types.length) return true;
  if (!vehicleType) return true;
  return types.includes(vehicleType);
}

// ---------------------------------------------------------------------------
// Clientside implementations (also used as the fallback)
// ---------------------------------------------------------------------------

export function filterServices(filters: CatalogFilters, items = SERVICE_CATALOG): CatalogPage<CatalogService> {
  const filtered = items.filter(
    (s) =>
      matchesText([s.name, s.category, s.description, s.hsnSacCode], filters.q) &&
      (!filters.category || s.category === filters.category) &&
      inPriceRange(s.rate, filters) &&
      forVehicleType(s.vehicleTypes, filters.vehicleType)
  );
  return paginate(filtered, filters.page, filters.limit);
}

export function filterPackages(filters: CatalogFilters, items = PACKAGE_CATALOG): CatalogPage<CatalogPackage> {
  const filtered = items.filter(
    (p) =>
      matchesText([p.name, p.description], filters.q) &&
      inPriceRange(p.price, filters) &&
      forVehicleType(p.vehicleTypes, filters.vehicleType)
  );
  return paginate(filtered, filters.page, filters.limit);
}

export function filterParts(filters: CatalogFilters, items = PART_CATALOG): CatalogPage<CatalogPart> {
  const filtered = items.filter(
    (p) =>
      matchesText([p.name, p.partNumber, p.brand, p.category, p.hsnCode], filters.q) &&
      (!filters.category || p.category === filters.category) &&
      (!filters.brand || p.brand === filters.brand) &&
      inPriceRange(p.rate, filters)
  );
  return paginate(filtered, filters.page, filters.limit);
}

export function filterLabour(filters: CatalogFilters, items = LABOUR_CATALOG): CatalogPage<CatalogLabour> {
  const filtered = items.filter(
    (l) => matchesText([l.description, l.sacCode], filters.q) && inPriceRange(l.rate, filters)
  );
  return paginate(filtered, filters.page, filters.limit);
}

/** Distinct facet values for the filter dropdowns. */
export function catalogFacets() {
  return {
    serviceCategories: Array.from(new Set(SERVICE_CATALOG.map((s) => s.category))).sort(),
    partCategories: Array.from(new Set(PART_CATALOG.map((p) => p.category || '')))
      .filter(Boolean)
      .sort(),
    partBrands: Array.from(new Set(PART_CATALOG.map((p) => p.brand))).sort(),
  };
}

// ---------------------------------------------------------------------------
// Server-first API
// ---------------------------------------------------------------------------

interface Searchable {
  (filters: CatalogFilters, signal?: AbortSignal): Promise<CatalogPage<any>>;
}

async function searchWithFallback<T>(
  path: string,
  filters: CatalogFilters,
  fallback: () => CatalogPage<T>,
  signal?: AbortSignal
): Promise<CatalogPage<T>> {
  try {
    const res = await api.get(path, { params: filters, signal });
    const body = res.data;
    if (body?.data) {
      return {
        data: body.data,
        pagination: body.pagination || {
          page: filters.page,
          limit: filters.limit,
          total: body.data.length,
          totalPages: 1,
        },
      };
    }
    throw new Error('empty');
  } catch (err: any) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    return fallback();
  }
}

export const searchServices: Searchable = (filters, signal) =>
  searchWithFallback('/estimates/catalog/services', filters, () => filterServices(filters), signal);

export const searchPackages: Searchable = (filters, signal) =>
  searchWithFallback('/estimates/catalog/packages', filters, () => filterPackages(filters), signal);

export const searchParts: Searchable = (filters, signal) =>
  searchWithFallback('/estimates/catalog/parts', filters, () => filterParts(filters), signal);

export const searchLabour: Searchable = (filters, signal) =>
  searchWithFallback('/estimates/catalog/labour', filters, () => filterLabour(filters), signal);

/** Suggested services for an inspection point, e.g. "Brakes" -> brake services. */
export function suggestServicesFor(inspectionItemName: string, limit = 5): CatalogService[] {
  const words = (inspectionItemName || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  if (!words.length) return SERVICE_CATALOG.slice(0, limit);
  const scored = SERVICE_CATALOG.map((s) => {
    const haystack = `${s.name} ${s.category} ${s.description || ''}`.toLowerCase();
    const score = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
  return (scored.length ? scored : SERVICE_CATALOG).slice(0, limit);
}

export function findServiceById(id: string): CatalogService | undefined {
  return SERVICE_CATALOG.find((s) => s.id === id);
}

export function findPackageById(id: string): CatalogPackage | undefined {
  return PACKAGE_CATALOG.find((p) => p.id === id);
}

export function findPartById(id: string): CatalogPart | undefined {
  return PART_CATALOG.find((p) => p.id === id);
}

export function findLabourById(id: string): CatalogLabour | undefined {
  return LABOUR_CATALOG.find((l) => l.id === id);
}

// ---------------------------------------------------------------------------
// Business configuration
// ---------------------------------------------------------------------------

async function requestBusinessConfig(): Promise<EstimateBusinessConfig> {
  try {
    const res = await api.get('/estimates/config');
    const data = res.data?.data;
    if (!data) throw new Error('empty');
    return {
      ...DEFAULT_BUSINESS_CONFIG,
      ...data,
      company: { ...DEFAULT_BUSINESS_CONFIG.company, ...(data.company || {}) },
      terms: data.terms?.length ? data.terms : DEFAULT_BUSINESS_CONFIG.terms,
    };
  } catch {
    return DEFAULT_BUSINESS_CONFIG;
  }
}

// The configuration changes rarely, so it is fetched once per session and
// shared by every caller (several step mounts ask for it). Concurrent callers
// join the same in-flight request. Failures are not cached, so a later attempt
// can still pick up the real values.
let cachedConfig: EstimateBusinessConfig | null = null;
let inFlightConfig: Promise<EstimateBusinessConfig> | null = null;

/** Reset the cached value — used by tests. */
export function clearBusinessConfigCache(): void {
  cachedConfig = null;
  inFlightConfig = null;
}

export function getBusinessConfig(): Promise<EstimateBusinessConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (!inFlightConfig) {
    inFlightConfig = requestBusinessConfig()
      .then((config) => {
        cachedConfig = config;
        return config;
      })
      .finally(() => {
        inFlightConfig = null;
      });
  }
  return inFlightConfig;
}

export default {
  searchServices,
  searchPackages,
  searchParts,
  searchLabour,
  getBusinessConfig,
  clearBusinessConfigCache,
  suggestServicesFor,
  catalogFacets,
  DEFAULT_CATALOG_FILTERS,
};
