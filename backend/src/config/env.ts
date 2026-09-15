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
};

export default env;