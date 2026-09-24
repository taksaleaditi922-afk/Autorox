# Job card approval

Admin approval and summary now follow the supplied screenshot layout: compact tables, customer/vehicle detail cards, and the bottom Add Advance / Print / Back / Save / Save & Next bar. Customer sharing opens a small dialog.

The backend issues seven-day approval links tied to the saved services and registered customer phone. It logs the first view, requires a rejection reason and atomically prevents duplicate or stale decisions. Actioned links remain readable for tracking. Pricing changes invalidate pending links; approved pricing is locked. Assignment and payment updates remain available.

Configure PUBLIC_APP_URL, BUSINESS_NAME, BUSINESS_PHONE, BUSINESS_WHATSAPP and BUSINESS_LOGO_URL on the backend. Configure NOTIFY_WEBHOOK_URL and NOTIFY_WEBHOOK_TOKEN for automatic delivery; without a provider, Share to Customer opens a WhatsApp click-to-chat fallback.

The public page refreshes every 15 seconds. Tracking displays recorded events only. The current job status model does not record separate inspection or quality-check completion events.

Frontend preview configuration: VITE_BUSINESS_NAME and VITE_APPROVAL_PREVIEW_IMAGE (public HTTPS image). Vite emits application-wide Open Graph tags; tenant-specific preview HTML requires server rendering.
