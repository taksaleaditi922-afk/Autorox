import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { notFound } from './utils/asyncHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import jobCardRoutes from './routes/jobCardRoutes.js';
import estimateRoutes from './routes/estimateRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import advisorRoutes from './routes/advisorRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import productsRoutes from './routes/productsRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import partOrderRoutes from './routes/partOrderRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

const app = express();

// Security & middleware
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/', (req, res) =>
  res.json({ success: true, message: 'AutoGarage API is running', health: '/api/health' })
);

app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'AutoGarage API is running', uptime: process.uptime() })
);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/jobcards', jobCardRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/advisors', advisorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock-transactions', stockRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/part-orders', partOrderRoutes);

// Customer-facing, token authenticated (no login). Mounted last so a public
// path can never shadow an authenticated API route.
app.use('/api/public', publicRoutes);

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

export default app;
