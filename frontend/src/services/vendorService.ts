import { useEffect, useState } from 'react';
import api from './api';
export interface VendorOption { id: string; name: string; phone?: string; state?: string; gstNumber?: string }
export const VENDOR_REQUIRED = false;
// The only vendor fetch location. Replace this source when the Vendor module is introduced.
export async function fetchVendors(signal?: AbortSignal): Promise<VendorOption[]> {
  return (await api.get('/part-orders/vendors', { signal })).data.data;
}
export function useVendors() {
  const [vendors, setVendors] = useState<VendorOption[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    fetchVendors(controller.signal).then(data => { if (!controller.signal.aborted) setVendors(data); }).catch(e => { if (!controller.signal.aborted) setError(e?.response?.data?.error || 'Unable to load vendors.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);
  return { vendors, loading, error, retry: () => setVersion(v => v + 1) };
}
