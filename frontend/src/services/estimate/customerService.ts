// ---------------------------------------------------------------------------
// Customer search / CRUD abstraction for the estimate workflow.
// Backed by the existing /api/customers endpoints.
// ---------------------------------------------------------------------------

import api from '../api';
import type { Customer, CustomerSummary } from './types';

const SEARCH_LIMIT = 8;

function mapCustomer(doc: any): Customer {
  return {
    id: doc._id || doc.id,
    name: doc.name || '',
    phone: doc.phone || '',
    alternatePhone: doc.alternatePhone || '',
    email: doc.email || '',
    address: doc.address || '',
    city: doc.city || '',
    state: doc.state || '',
    pincode: doc.pincode || '',
    gstNumber: doc.gstNumber || '',
  };
}

function mapVehicles(docs: any[]): CustomerSummary['vehicles'] {
  return (docs || []).map((v) => ({
    id: v._id || v.id,
    registrationNumber: v.registrationNumber || '',
    brand: v.make || v.brand || '',
    model: v.model || '',
    year: v.year,
    fuelType: v.fuelType,
    color: v.color,
    odometer: v.odometerReading ?? v.odometer,
  }));
}

function mapSummary(doc: any): CustomerSummary {
  return {
    ...mapCustomer(doc),
    id: (doc._id || doc.id) as string,
    vehicles: mapVehicles(doc.vehicles),
  };
}

/** searchCustomers(query) — used by the autocomplete field. */
export async function searchCustomers(query: string, signal?: AbortSignal): Promise<CustomerSummary[]> {
  const q = (query || '').trim();
  try {
    const res = await api.get('/customers', {
      params: { q, page: 1, limit: SEARCH_LIMIT },
      signal,
    });
    const docs = res.data?.data || [];
    return docs.map(mapSummary);
  } catch (err: any) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    throw new Error('Customer search is unavailable. You can enter the customer manually.');
  }
}

export async function getCustomer(id: string): Promise<CustomerSummary> {
  const res = await api.get(`/customers/${id}`);
  return mapSummary(res.data?.data);
}

export async function getCustomerVehicles(id: string): Promise<CustomerSummary['vehicles']> {
  const res = await api.get(`/customers/${id}/vehicles`);
  return mapVehicles(res.data?.data);
}

export async function createCustomer(customer: Customer): Promise<Customer> {
  const payload = {
    name: customer.name,
    phone: customer.phone.replace(/\D/g, '').slice(-10),
    email: customer.email || undefined,
    address: customer.address || undefined,
    city: customer.city || undefined,
    state: customer.state || undefined,
    pincode: customer.pincode || undefined,
  };
  const res = await api.post('/customers', payload);
  return mapCustomer(res.data?.data);
}

/**
 * Best-effort linking so the customer record exists before an estimate is
 * generated. Failures never block estimate generation — the estimate carries
 * its own embedded customer snapshot.
 */
export async function ensureCustomer(customer: Customer): Promise<Customer> {
  if (customer.id) return customer;
  try {
    return await createCustomer(customer);
  } catch {
    return customer;
  }
}

export default {
  searchCustomers,
  getCustomer,
  getCustomerVehicles,
  createCustomer,
  ensureCustomer,
};
