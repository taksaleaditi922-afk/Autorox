import dotenv from 'dotenv';

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autogarage',
  jwtSecret: process.env.JWT_SECRET || 'supersecret-jwt-key-change-me',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '30m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'super-refresh-key-change-me',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@autorox.in',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'AutoRox#2024',

  // Vehicle registry (RC) lookup. Deliberately unset by default: without a URL
  // the API reports `NOT_CONFIGURED` and the UI falls back to manual entry.
  // Works with Surepass / Cashfree / Signzy / Perfios / Zoop / VahanX or any
  // endpoint that takes a registration number and answers with vehicle JSON.
  //   VEHICLE_REGISTRY_URL=https://kyc-api.example.com/api/v1/vehicle/rc/{reg}
  vehicleRegistry: {
    url: process.env.VEHICLE_REGISTRY_URL || '',
    key: process.env.VEHICLE_REGISTRY_KEY || '',
    method: String(process.env.VEHICLE_REGISTRY_METHOD || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET',
    /** bearer | x-api-key | basic | query */
    authStyle: String(process.env.VEHICLE_REGISTRY_AUTH_STYLE || 'bearer').toLowerCase(),
    authHeader: process.env.VEHICLE_REGISTRY_AUTH_HEADER || 'x-api-key',
    keyParam: process.env.VEHICLE_REGISTRY_KEY_PARAM || 'key',
    clientId: process.env.VEHICLE_REGISTRY_CLIENT_ID || '',
    clientSecret: process.env.VEHICLE_REGISTRY_CLIENT_SECRET || '',
    /** Name of the registration-number field, used for GET query and POST body. */
    param: process.env.VEHICLE_REGISTRY_PARAM || 'registrationNumber',
    timeoutMs: parseInt(process.env.VEHICLE_REGISTRY_TIMEOUT_MS, 10) || 8000,
    cacheTtlSeconds: parseInt(process.env.VEHICLE_REGISTRY_CACHE_TTL_SECONDS, 10) || 86400,
  },

  /** Base URL customers open; used to build the public service-list approval link. */
  publicUrl: process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  business: {
    name: process.env.BUSINESS_NAME || process.env.NOTIFY_SENDER || 'AutoRox',
    phone: process.env.BUSINESS_PHONE || '',
    whatsapp: process.env.BUSINESS_WHATSAPP || process.env.BUSINESS_PHONE || '',
    logoUrl: process.env.BUSINESS_LOGO_URL || '',
  },

  // Customer notifications (SMS / WhatsApp / Email) for the service list approval
  // link and status updates. Unset by default: sharing still records the action
  // and returns the link, but nothing is transmitted until a provider is wired.
  //   NOTIFY_WEBHOOK_URL=https://api.provider.com/v1/messages
  notifications: {
    webhookUrl: process.env.NOTIFY_WEBHOOK_URL || '',
    webhookToken: process.env.NOTIFY_WEBHOOK_TOKEN || '',
    sender: process.env.NOTIFY_SENDER || 'AutoRox',
    timeoutMs: parseInt(process.env.NOTIFY_TIMEOUT_MS, 10) || 8000,
  },
};

export default env;
