import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db/database.js';
import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

const app = express();

// Middlewares
app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/stats', statsRoutes);

// Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Vouch API', version: '1.0.0' });
});

// Initialize database schema and start server
async function startServer() {
  try {
    await initDb();
    console.log('✅ SQLite database initialized successfully.');

    app.listen(config.port, () => {
      console.log(`🛡️ Vouch Backend running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start Vouch server:', err);
    process.exit(1);
  }
}

startServer();

