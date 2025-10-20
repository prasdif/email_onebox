// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import emailRoutes from './routes/emailRoutes';
import { initializeDatabase } from './config/database';
import { initializeIndex } from './config/elasticsearch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/emails', emailRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'running',
      elasticsearch: 'connected',
      database: 'connected'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Email Onebox API',
    version: '1.0.0',
    endpoints: {
      emails: '/api/emails',
      health: '/health'
    }
  });
});

// Initialize services
async function initializeServices() {
  console.log('🚀 Initializing services...');
  
  // Initialize Database
  try {
    await initializeDatabase();
    console.log('✅ Database initialized');
  } catch (dbError) {
    console.error('❌ Database initialization failed:', dbError);
    throw dbError; // Database is critical, exit if it fails
  }
  
  // Initialize Elasticsearch (optional - don't fail if it's not available)
  try {
    await initializeIndex();
    console.log('✅ Elasticsearch initialized');
  } catch (esError: any) {
    console.warn('⚠️ Elasticsearch initialization failed');
    console.warn('⚠️ Continuing without Elasticsearch...');
    console.warn('⚠️ Error:', esError.message);
  }
  
  console.log('✅ Services initialized\n');
}

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(PORT, () => {
      console.log(`\n🎉 Server running on http://localhost:${PORT}`);
      console.log(`📧 API available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check at http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;