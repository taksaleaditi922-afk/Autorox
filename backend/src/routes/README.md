# Page API modules

Page-specific files are separated by responsibility under `backend/src`:

```text
src/
  routes/
    jobCardRoutes.ts       # URLs, methods, authentication, validation, uploads
    inventoryRoutes.ts
  controllers/
    jobCardController.ts   # Request input, status codes, cookies, response output
    inventoryController.ts
  services/
    jobCardService.ts      # Business rules, calculations, persistence
    inventoryService.ts
```

Services accept ordinary data and return results. They do not receive Express request/response objects. Shared schemas stay in `src/models`; reusable providers and document renderers stay in `src/services`. `src/app.ts` mounts each feature while retaining the existing API URLs.

Related pages share the corresponding route, controller and service files so creating, editing and viewing the same record follow the same business rules.

| Frontend page | Route file in `src/routes` | API prefix |
| --- | --- | --- |
| Login | `authRoutes.ts` | `/api/auth` |
| Dashboard | `analyticsRoutes.ts` | `/api/analytics` |
| JobCards | `jobCardRoutes.ts` | `/api/jobcards` |
| JobCardForm (new/edit) | `jobCardRoutes.ts` | `/api/jobcards` |
| JobCardDetails | `jobCardRoutes.ts` | `/api/jobcards/:id` |
| Estimates | `estimateRoutes.ts` | `/api/estimates` |
| EstimateWizard (new/edit/detail) | `estimateRoutes.ts` | `/api/estimates` |
| Customers | `customerRoutes.ts` | `/api/customers` |
| Vehicles | `vehicleRoutes.ts` | `/api/vehicles` |
| Advisors | `advisorRoutes.ts` | `/api/advisors` |
| Reports | `reportRoutes.ts`, `analyticsRoutes.ts` | `/api/reports`, `/api/analytics/advisor-performance` |
| Inventory | `inventoryRoutes.ts`, `productsRoutes.ts`, `stockRoutes.ts` | `/api/inventory`, `/api/products`, `/api/stock-transactions` |
| Settings | `settingsRoutes.ts` | `/api/settings` |
| SellProducts | `salesRoutes.ts`, `productsRoutes.ts`, `customerRoutes.ts` | `/api/sales`, `/api/products`, `/api/customers` |
| BillDetails | `salesRoutes.ts` | `/api/sales/:id` |
| PublicApproval | `publicRoutes.ts` | `/api/public/approvals/:token` |

Controllers and services use the corresponding names, such as `customerController.ts` and `customerService.ts`. Job card documents use `documentController.ts` / `documentService.ts`. Estimate drafts, catalog, inspection, payments and media use `estimateDraftController.ts` / `estimateDraftService.ts`. Products and movements use `productController.ts` / `productService.ts` and `stockTransactionController.ts` / `stockTransactionService.ts`. Each file stays in its own layer's folder.

## Inventory connections

- `GET /api/inventory`: server-side search, filters, sorting and pagination, with stable `id` values.
- `GET /api/inventory/stats`, `/insights`, `/alerts`: calculated from saved products.
- `GET /api/inventory/orders`: saved purchase-order records, initially empty if none exist. The existing Order tab is a read-only list; it has no purchase-order creation form.
- `GET /api/inventory/inward`, `/issued`, `/purchase-returns`: saved stock movements, including sale issues. All four record tabs support pagination.
- `GET /api/stock-transactions/:productId`: the selected product's movement history.
- `POST /api/stock-transactions`: validates the movement and changes stock with an audit record.
- `PATCH /api/products/:id/stock`: changes stock fields and logs quantity adjustments.

Inventory API failures are displayed as errors. They never substitute demo items, orders or successful local stock edits. Catalog searches also propagate API failures. Estimate draft recovery still intentionally stores a local copy, with its existing explicit local/server save status.

## Database and provider setup

On Windows, `npm --prefix backend run db:setup` installs a checksum-verified local MongoDB binary, backs up any existing stopped database, and starts a local replica set using `backend/data/mongodb`. The binary stays in ignored `backend/.tools`; database files persist across restarts. After setup, `npm --prefix backend run dev` checks MongoDB and starts it in the background when needed. `npm --prefix backend run db:start` runs that check independently. A configured remote database is checked but never replaced with a local database.

Set `MONGODB_URI` in `backend/.env`. Stock edits and movements use MongoDB transactions so the stock balance and history commit together. Use MongoDB Atlas or a replica set; a standalone MongoDB server cannot run these transactions. For local development, configure MongoDB with `replication.replSetName: rs0`, initialize it using `rs.initiate()` in `mongosh`, and use `mongodb://127.0.0.1:27017/autogarage?replicaSet=rs0`. Configure the database before enabling stock writes.

The current models use a shared database without tenant scoping. Separate workshop deployments need separate databases/configuration; this refactor does not introduce a shared multi-tenant hosting system.

Vehicle registry lookups and automated customer notifications retain their existing provider configuration requirements. Browser printing and manual share links retain their existing behavior.

## Verification

From the repository root:

```sh
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix backend test
npm --prefix frontend test
```

`routes.test.ts` checks the page API contracts, router mounting, authentication and HTTP error forwarding. Inventory tests check filtering/pagination, stock validation, transaction participation, stock history and frontend failure handling. Database-dependent behavior is mocked in the unit tests; live database testing requires a reachable replica set.
