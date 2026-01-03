/**
 * PHTS System - Main Server Entry Point
 *
 * Express server with authentication, CORS, and security middleware
 *
 * Date: 2025-12-30
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection, closePool } from './config/database.js';
import { initializePassport } from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import signatureRoutes from './routes/signatureRoutes.js';
import { ApiResponse } from './types/auth.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Security Middleware
 */
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());

/**
 * CORS Configuration
 * Allow requests from Next.js frontend
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/**
 * Body Parser Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Logging Middleware
 * Use 'combined' format in production, 'dev' format in development
 */
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

/**
 * Initialize Passport for JWT authentication
 */
app.use(initializePassport());

/**
 * Health Check Route
 */
app.get('/health', (_req: Request, res: Response<ApiResponse>) => {
  res.status(200).json({
    success: true,
    message: 'PHTS API is running',
    data: {
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      port: PORT,
    },
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/signatures', signatureRoutes);

/**
 * 404 Handler - Route Not Found
 */
app.use((req: Request, res: Response<ApiResponse>) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

/**
 * Global Error Handler
 * Catches all errors thrown in the application
 */
app.use(
  (
    err: Error,
    _req: Request,
    res: Response<ApiResponse>,
    _next: NextFunction
  ) => {
    console.error('Error:', err.stack);

    // Don't expose error details in production
    const errorMessage =
      NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : err.message;

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
);

/**
 * Start Server
 * Test database connection before starting the server
 */
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    await testConnection();

    // Start Express server (skip in tests)
    if (NODE_ENV === 'test') {
      return;
    }

    app.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  PHTS Backend Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Environment: ${NODE_ENV}`);
      console.log(`  Port: ${PORT}`);
      console.log(`  URL: http://localhost:${PORT}`);
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 * Close database connections before exiting
 */
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await closePool();
    console.log('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
if (NODE_ENV !== 'test') {
  startServer();
}

export default app;
