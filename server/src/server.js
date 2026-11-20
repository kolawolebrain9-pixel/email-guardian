import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb } from './db/database.js';
import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy for accurate client IP rate limiting in cloud environments (Render, Railway, etc.)
app.set('trust proxy', 1);

// Middlewares
app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// --- Rate Limiting (Day 1 Abuse Protection) ---

// 1. Global API Limiter (100 requests per 15 minutes per IP)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down and try again shortly.',
    status: 429
  }
});

// 2. Email Scanner Limiter (15 scans per minute per IP — protects Gmail API & OpenAI costs)
const emailScanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'You have scanned recently. Please wait a minute before rescanning.',
    status: 429
  }
});

// 3. Auth Flow Limiter (20 attempts per 15 minutes per IP — protects OAuth callback and token exchange)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in a few minutes.',
    status: 429
  }
});

// Apply global rate limiting to all /api endpoints
app.use('/api', globalApiLimiter);

// API Routes with Tiered Protection
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/emails', emailScanLimiter, emailRoutes);
app.use('/api/stats', statsRoutes);

// Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Vouch API', version: '1.0.0' });
});

// Serve frontend static files if built (Production deployment support)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Initialize database schema and start server
async function startServer() {
  try {
    await initDb();
    console.log('✅ Database initialized successfully.');

    const host = '0.0.0.0';
    app.listen(config.port, host, () => {
      console.log(`🛡️ Vouch Backend running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start Vouch server:', err);
    process.exit(1);
  }
}

startServer();
