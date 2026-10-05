import api from './api';
export interface OrderItem {
  productId: string; partName: string; partNumber: string; vehicleType?: string; partType?: string;
  quantity: number; unitPrice: number; unit?: string; hsn?: string;
  taxPercent?: number; discountType?: 'Percentage' | 'Amount'; discountValue?: number;
  taxAmount?: number; discountTotal?: number; totalAmount?: number;
}
export interface PurchaseInvoice {
  invoiceNumber: string; date: string; generatedAt: string;
  vendor: { id: string | null; name: string; phone?: string };
  items: OrderItem[]; subtotal: number; discountTotal: number; taxAmount: number; totalAmount: number;
  billNumber?: string; billDate?: string;
}
export interface PartOrder {
  id: string; orderNumber: string; vendorId?: string | null; vendorName: string; vendorPhone?: string;
  customerName?: string; notes?: string; status: 'Pending' | 'Received' | 'Cancelled';
  orderDate: string; expectedDelivery?: string; receivedDate?: string; totalAmount: number;
  items: OrderItem[]; bulk: boolean; isDraft?: boolean; __v?: number;
  subtotal?: number; discountTotal?: number; taxAmount?: number;
  managePurchase?: boolean; billNumber?: string; billDate?: string; invoice?: PurchaseInvoice | null;
}
export interface OrderSummary { total: number; pending: number; completed: number; value: number }
export const orderErrorMessage = (error: any) => error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unable to load orders. Please try again.';
export const ordersApi = {
  list: async (params: Record<string, unknown>, signal?: AbortSignal) => (await api.get('/part-orders', { params, signal })).data as { data: PartOrder[]; pagination: { total: number } },
  get: async (id: string, signal?: AbortSignal) => (await api.get(`/part-orders/${id}`, { signal })).data.data as PartOrder,
  summary: async (signal?: AbortSignal) => (await api.get('/part-orders/summary', { signal })).data.data as OrderSummary,
  suggestions: async (params: Record<string, unknown>, signal?: AbortSignal) => (await api.get('/part-orders/suggestions', { params, signal })).data,
  save: async (data: unknown, id?: string) => id ? api.put(`/part-orders/${id}`, data) : api.post('/part-orders', data),
  saveBulk: async (data: unknown, id?: string) => (id ? await api.put(`/part-orders/bulk-order/${id}`, data) : await api.post('/part-orders/bulk-order', data)).data.data as PartOrder,
  deleteBulk: async (id: string) => api.delete(`/part-orders/bulk-order/${id}`),
  action: async (id: string, action: 'receive' | 'cancel') => api.post(`/part-orders/${id}/${action}`),
  preview: async (csv: string) => (await api.post('/part-orders/bulk/preview', { csv })).data.data,
  bulk: async (csv: string) => api.post('/part-orders/bulk', { csv }),
};
