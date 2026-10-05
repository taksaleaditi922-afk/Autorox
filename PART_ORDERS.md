# Part Orders and Bulk Orders

Open `/part-orders`; Bulk Orders uses `?tab=bulk`. Add New opens `/part-orders/bulk/new`, and Edit opens `/part-orders/bulk/:id/edit`.

## Browser checks

1. Bulk list: seven columns, one row per order, vendor truncation/tooltip, search, status filter, pagination, skeletons, empty state, and retry. Received orders cannot be edited/deleted. Drafts show a Draft date caption and cannot be received.
2. Details: existing header, two-step progress, date fields, optional vendor, Inventory search by name/number/barcode, part pagination, Add Selected for checked existing parts, and disabled already-added parts. The + Add button opens the Add New Part drawer. Rate, quantity, tax, and discount remain editable. Desktop cards sit side by side; mobile cards stack.
3. Summary: Add More/back preserve state; check editable lines, Manage Purchase expansion, optional bill number/date, synchronized vendor selection, billing totals, and zero-rate warnings. Completed Details can be reopened from the stepper.
4. Save: persists a Pending draft without an invoice, then returns to Bulk Orders. Editing the draft can finalize it later. A finalized order cannot revert to draft.
5. Create Order: saves a finalized Pending order and its purchase-invoice snapshot in one MongoDB document, returns to the list, and opens its invoice preview. View reopens the saved invoice; Print / Save as PDF uses the existing print service.
6. Receive: Update confirms receipt of all quantities, logs employee stock history, and updates Inventory through the shared stock service. Repeated receipts cannot add stock again. Creating/saving an invoice does not change stock.
7. Edit/Delete: edits check document version to reject stale changes. Pending bulk orders can be soft-deleted with confirmation; received orders cannot.
8. Accessibility/mobile: keyboard navigation, labeled controls, responsive footer buttons, internal table scrolling, and no page-wide horizontal overflow. Back/navigation/reload warn about unsaved changes.

## Pricing

`shared/partOrderPricing.mjs` supplies Inventory's existing base formula and rounded bulk calculations to browser and backend. Existing Inventory calculation behavior is preserved. Backend totals are recalculated; client-submitted totals are ignored.

Discount is a percentage or a rupee amount **per unit**, matching Add Part. Tax applies after discount. Displayed line amounts and aggregate totals round to two decimals.

Example: rate 100, quantity 5, discount 10%, tax 18%:

| Subtotal | Discount | Taxable amount | Tax | Total |
| ---: | ---: | ---: | ---: | ---: |
| 500.00 | 50.00 | 450.00 | 81.00 | 531.00 |

Zero rates warn but remain allowed. HSN is optional and stored on newly created Inventory parts; unit comes from Inventory. Vehicle Type derives as 2W/4W/Mixed/unspecified.

## Vendor extension point

`vendorService.ts`/`useVendors` is the only browser vendor-fetch location. `VendorSelect.tsx` is reused in both steps and bound to one vendorId. The backend adapter currently derives real supplier names/phones from Inventory, returning an empty list when none exist. Replace this adapter when the Vendor module is available. Vendor state/GST remain unspecified when unavailable.

Vendor stays optional; `VENDOR_REQUIRED` flags mark the future requirement. IDs are nullable, and orders/invoices store name/contact snapshots. Existing snapshots survive renamed/removed suppliers. Add Vendor is a disabled extension point.

## Backend and deployment

`PartOrder` stores embedded lines, optional vendor ID/snapshot, dates, draft/finalized state, purchase bill fields, totals, employee IDs, and a saved purchase invoice. No migration was added. Existing orders remain readable; invoice snapshots are generated when finalized through the new flow.

Endpoints under `/api/part-orders`:

- GET `/`: filtered/paginated orders; `bulk=true` selects bulk orders.
- GET `/summary`, `/suggestions`, `/vendors`, `/:id`.
- POST `/bulk-order`: Save (`intent=draft`) or Create Order (`intent=finalize`).
- PUT `/bulk-order/:id`: edits with `version` concurrency check.
- DELETE `/bulk-order/:id`: soft-delete pending bulk orders.
- POST `/:id/receive`, `/:id/cancel`: existing lifecycle actions.
- Existing single-order and CSV preview/import endpoints remain available.

All endpoints require authentication; mutations require Admin or Service Manager. Receiving requires MongoDB transactions (replica set or Atlas); standalone MongoDB returns 503 without unsafe separate stock writes. Keep `shared` beside `backend` when deploying; the compiled backend imports its pricing module from there.

## Changed files

- Frontend: App.tsx routes; Layout.tsx width handling limited to Part Orders; PartOrders.tsx integration; BulkOrdersTab.tsx; CreateBulkOrder.tsx; VendorSelect.tsx.
- Services: partOrdersService.ts; vendorService.ts; purchaseInvoiceService.ts; optional purchase-document labels/colors in invoicePrintService.ts (existing defaults preserved).
- Pricing/tests: shared/partOrderPricing.mjs and declarations; Inventory pricing delegates to the unchanged shared base formula; bulk pricing and purchase invoice tests.
- Backend: PartOrder.ts schema; partOrderRoutes.ts; bulkOrderService.ts; expanded lifecycle tests.

Existing unrelated uncommitted Inventory changes were preserved.

## Validation results

- Frontend production build passed after the mobile correction.
- 33 focused tests passed: 22 backend lifecycle/stock tests and 11 frontend pricing/invoice tests.
- Pricing example verified: 500.00 subtotal - 50.00 discount + 81.00 tax = 531.00.
- Isolated headless Edge check with fixture API passed: Bulk Orders list, checked-part addition, Details to Summary, draft save, finalization redirect, and saved purchase invoice preview. No runtime exceptions were reported.
- At a 390px mobile viewport, document width remained 390px; the table scrolls within its card and footer buttons stack.
- Live MongoDB receipt integration has not been exercised. Backend compilation is still blocked by existing dependency/project typing errors; no errors were reported for the new order/pricing files.

## Add New Part in Bulk Details

The + Add button opens a right-side drawer with vehicle type, part number generation, name/type, brand, HSN, category/subcategory, quantity, unit creation, and purchase/sale pricing. It reuses Inventory pricing controls and calculations. Create uses the existing products API, stores the part with zero stock, and immediately adds the requested quantity and purchase pricing to the current order. Receiving updates stock through the existing order receipt flow. Cancel leaves the order unchanged; unsaved drawer changes prompt before closing. Existing Inventory parts can still be checked and added with Add Selected.

Brand/HSN and purchase/sale tax and discount metadata are optional Product fields; existing products remain compatible without a migration. A part created in the drawer remains in Inventory if the enclosing order is subsequently abandoned.
