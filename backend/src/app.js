import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import logger from './config/logger.js';
import { generalLimiter } from './middleware/rateLimit.middleware.js';
import { startCronScheduler } from './cron.js';

// Route Imports
import authRoutes from './routes/auth.routes.js';
import habitsRoutes from './routes/habits.routes.js';
import progressRoutes from './routes/progress.routes.js';
import challengeRoutes from './routes/challenge.routes.js';
import moodRoutes from './routes/mood.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import partnersRoutes from './routes/partners.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set up Request Logging via Morgan redirected to Winston stream
const morganStream = {
  write: (message) => logger.info(message.trim())
};
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

// Configure CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Mobile clients generally do not send an Origin header.
    // Allow requests with no origin (like mobile apps).
    if (!origin) {
      callback(null, true);
    } else {
      // In web simulator or browser, allow localhost
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// Restrict requests based on Client App Bundle ID
app.use((req, res, next) => {
  const appBundleId = process.env.APP_BUNDLE_ID || 'host.exp.Exponent';
  const clientBundleHeader = req.headers['x-app-bundle-id'];

  // If a header is provided, assert it matches our bundle ID
  if (clientBundleHeader && clientBundleHeader !== appBundleId) {
    logger.warn(`Rejected request from unauthorized bundle ID: ${clientBundleHeader}`);
    return res.status(403).json({ error: 'Access denied: Unauthorized mobile bundle source.' });
  }
  next();
});

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply General Rate Limiter
app.use(generalLimiter);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/notifications', notificationsRoutes);

// Base route for health checking
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  logger.error(`Unhandler Error: ${err.message}`, { stack: err.stack });
  
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    // only expose stack in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Initialize Cron Job Schedulers
startCronScheduler();

// Start express server
app.listen(PORT, () => {
  logger.info(`Discipline OS Server listening on port ${PORT}`);
});

export default app;
