import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Server } from 'node:http';
import app from '../app.js';
import auth from './authRoutes.js';
import dashboard from './analyticsRoutes.js';
import jobs from './jobCardRoutes.js';
import estimates from './estimateRoutes.js';
import customers from './customerRoutes.js';
import vehicles from './vehicleRoutes.js';
import advisors from './advisorRoutes.js';
import reports from './reportRoutes.js';
import settings from './settingsRoutes.js';
import sales from './salesRoutes.js';
import inventory from './inventoryRoutes.js';
import products from './productsRoutes.js';
import stock from './stockRoutes.js';
import approvals from './publicRoutes.js';

// Every frontend screen's API contract, including form, detail and public routes.
const contracts = [
  ['/api/auth', auth, { post: ['login', 'change-password', 'logout', 'refresh-token'], get: ['me'] }],
  ['/api/analytics', dashboard, { get: ['dashboard', 'advisor-performance'] }],
  ['/api/jobcards', jobs, { get: ['', 'stats', ':id', ':id/documents'], post: ['', ':id/documents', ':id/print', ':id/approval/share'], put: [':id'], patch: [':id/status', ':id/advance', ':id/approval'], delete: [':id', ':id/documents/:docId'] }],
  ['/api/estimates', estimates, { get: ['', ':id', 'config', 'next-number', 'catalog/services', 'catalog/packages', 'catalog/parts', 'catalog/labour', 'inspection/template', ':id/payments', ':id/media/:mediaId', ':id/pdf'], post: ['', 'drafts', 'inspection/categories', ':id/generate', ':id/payments', ':id/media', ':id/share', ':id/send-email', ':id/convert-invoice'], put: [':id', ':id/draft'], patch: [':id/approve', ':id/reject'], delete: [':id', ':id/payments/:paymentId', ':id/media/:mediaId'] }],
  ['/api/customers', customers, { get: ['', ':id', ':id/vehicles', ':id/jobcards'], post: [''], put: [':id'], patch: [':id/assign-advisor'], delete: [':id'] }],
  ['/api/vehicles', vehicles, { get: ['', ':id', 'lookup/:regNo'], post: [''], put: [':id'] }],
  ['/api/advisors', advisors, { get: ['', ':id/customers'], post: [''], put: [':id'], patch: [':id/status'] }],
  ['/api/reports', reports, { get: ['jobcards'] }],
  ['/api/settings', settings, { get: ['', 'service-types'], put: [''], post: ['service-types'], delete: ['service-types/:id'] }],
  ['/api/sales', sales, { get: ['', ':id', ':id/payments'], post: ['', ':id/payment'], put: [':id'], patch: [':id/status'], delete: [':id'] }],
  ['/api/inventory', inventory, { get: ['', 'stats', 'insights', 'alerts', 'orders', 'inward', 'issued', 'purchase-returns'] }],
  ['/api/products', products, { get: ['', ':id', 'check-stock/:id'], post: [''], put: [':id'], patch: [':id/stock'], delete: [':id'] }],
  ['/api/stock-transactions', stock, { get: ['', ':productId'], post: [''] }],
  ['/api/public', approvals, { get: ['approvals/:token'], post: ['approvals/:token/respond'] }],
] as const;

for (const [prefix, router, methods] of contracts) {
  it(`mounts the frontend's routes at ${prefix}`, () => {
    expect((app as any)._router.stack.some(layer => layer.handle === router && layer.regexp.test(prefix))).toBe(true);
    for (const [method, paths] of Object.entries(methods)) {
      for (const path of paths) {
        expect(router.stack.some(layer => layer.route?.path === `/${path}` && layer.route.methods[method]), `${method.toUpperCase()} ${prefix}/${path}`).toBe(true);
      }
    }
  });
}

let server: Server;
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); });

it('responds to health checks and keeps workshop data authenticated', async () => {
  expect((await fetch(`${base}/api/health`)).status).toBe(200);
  for (const path of ['/api/inventory/stats', '/api/inventory/orders', '/api/jobcards', '/api/sales', '/api/products', '/api/settings']) {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false });
  }
});

it('forwards service validation errors through HTTP controllers', async () => {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ success: false, error: 'Email and password are required' });
});
