import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute upload directory (relative to project root)
const rootDir = path.resolve(__dirname, '..', '..');
const uploadDir = path.isAbsolute(env.uploadDir)
  ? env.uploadDir
  : path.join(rootDir, env.uploadDir);

fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const maxSize = env.maxFileSizeMb * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter,
});

export { uploadDir };
export const allowedFileTypes = allowedExtensions;