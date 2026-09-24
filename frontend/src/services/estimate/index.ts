// ---------------------------------------------------------------------------
// Estimate service layer barrel.
//
// UI components import from here only — never from axios directly — so every
// provider (vehicle registry, address search, PDF engine, SMS/WhatsApp, file
// storage) can be replaced without touching a page.
// ---------------------------------------------------------------------------

export * as addressService from './addressService';
export * as catalogService from './catalogService';
export * as customerService from './customerService';
export * as draftStorage from './draftStorage';
export * as estimateService from './estimateService';
export * as inspectionService from './inspectionService';
export * as mediaService from './mediaService';
export * as notificationService from './notificationService';
export * as paymentService from './paymentService';
export * as pdfService from './pdfService';
export * as vehicleService from './vehicleService';

export * from './types';
export * from './config';
