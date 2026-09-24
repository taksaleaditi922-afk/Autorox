// ---------------------------------------------------------------------------
// Address search abstraction.
//
// The UI only ever talks to addressService.search(). Which map/geocoding
// provider backs it is a configuration detail: set VITE_ADDRESS_API_URL +
// VITE_ADDRESS_API_KEY to use a real provider, otherwise a small built-in
// dataset keeps the field usable offline. Manual entry always remains possible.
// ---------------------------------------------------------------------------

import type { AddressSuggestion } from './types';

export interface AddressProvider {
  name: string;
  search(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]>;
}

const LOCAL_PLACES: Omit<AddressSuggestion, 'id'>[] = [
  { label: 'Andheri East, Mumbai, Maharashtra', line1: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400069' },
  { label: 'Powai, Mumbai, Maharashtra', line1: 'Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076' },
  { label: 'Bandra West, Mumbai, Maharashtra', line1: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
  { label: 'Kothrud, Pune, Maharashtra', line1: 'Kothrud', city: 'Pune', state: 'Maharashtra', pincode: '411038' },
  { label: 'Hinjewadi, Pune, Maharashtra', line1: 'Hinjewadi Phase 1', city: 'Pune', state: 'Maharashtra', pincode: '411057' },
  { label: 'Koramangala, Bengaluru, Karnataka', line1: 'Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560095' },
  { label: 'Whitefield, Bengaluru, Karnataka', line1: 'Whitefield', city: 'Bengaluru', state: 'Karnataka', pincode: '560066' },
  { label: 'Indiranagar, Bengaluru, Karnataka', line1: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
  { label: 'Banjara Hills, Hyderabad, Telangana', line1: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' },
  { label: 'Gachibowli, Hyderabad, Telangana', line1: 'Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032' },
  { label: 'Anna Nagar, Chennai, Tamil Nadu', line1: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' },
  { label: 'T Nagar, Chennai, Tamil Nadu', line1: 'T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017' },
  { label: 'Sector 18, Noida, Uttar Pradesh', line1: 'Sector 18', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
  { label: 'Connaught Place, New Delhi, Delhi', line1: 'Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
  { label: 'Sector 29, Gurugram, Haryana', line1: 'Sector 29', city: 'Gurugram', state: 'Haryana', pincode: '122002' },
  { label: 'SG Highway, Ahmedabad, Gujarat', line1: 'SG Highway', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054' },
  { label: 'Salt Lake, Kolkata, West Bengal', line1: 'Salt Lake Sector 5', city: 'Kolkata', state: 'West Bengal', pincode: '700091' },
  { label: 'MI Road, Jaipur, Rajasthan', line1: 'MI Road', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
  { label: 'Kakkanad, Kochi, Kerala', line1: 'Kakkanad', city: 'Kochi', state: 'Kerala', pincode: '682030' },
  { label: 'Sector 17, Chandigarh', line1: 'Sector 17', city: 'Chandigarh', state: 'Chandigarh', pincode: '160017' },
];

class LocalAddressProvider implements AddressProvider {
  name = 'local';

  async search(query: string): Promise<AddressSuggestion[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return LOCAL_PLACES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.pincode.startsWith(q) ||
        p.city.toLowerCase().includes(q)
    )
      .slice(0, 8)
      .map((p) => ({ ...p, id: `${p.city}-${p.pincode}`, provider: 'local' }));
  }
}

/**
 * Adapter for any HTTP geocoding provider. Expected response:
 *   { suggestions: [{ label, line1, city, state, pincode }] }
 * Swap the response mapping here without touching the UI.
 */
class RemoteAddressProvider implements AddressProvider {
  name = 'remote';

  constructor(private url: string, private apiKey?: string) {}

  async search(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams({ q: query });
    if (this.apiKey) params.set('key', this.apiKey);
    const res = await fetch(`${this.url}?${params.toString()}`, { signal });
    if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
    const json = await res.json();
    const list = Array.isArray(json?.suggestions) ? json.suggestions : [];
    return list.map((s: any, index: number) => ({
      id: s.id || `${index}-${s.pincode || s.label}`,
      label: s.label,
      line1: s.line1 || s.label,
      city: s.city || '',
      state: s.state || '',
      pincode: s.pincode || '',
      provider: 'remote',
      raw: s,
    }));
  }
}

const addressApiUrl = (import.meta as any)?.env?.VITE_ADDRESS_API_URL as string | undefined;
const addressApiKey = (import.meta as any)?.env?.VITE_ADDRESS_API_KEY as string | undefined;

let provider: AddressProvider =
  addressApiUrl ? new RemoteAddressProvider(addressApiUrl, addressApiKey) : new LocalAddressProvider();

/** Swap the address provider at runtime (tests, feature flags, new vendor). */
export function setAddressProvider(next: AddressProvider): void {
  provider = next;
}

export function getAddressProvider(): AddressProvider {
  return provider;
}

/** True when no remote provider is configured, so the UI can say so. */
export function isUsingFallbackProvider(): boolean {
  return provider.name === 'local';
}

export async function search(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmed = (query || '').trim();
  if (trimmed.length < 3) return [];
  try {
    return await provider.search(trimmed, signal);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return [];
    // Search failure must never block the form — manual entry is always allowed.
    throw new Error('Address lookup is unavailable. Enter the address manually.');
  }
}

export default { search, setAddressProvider, getAddressProvider, isUsingFallbackProvider };
