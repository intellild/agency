import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';
import { initP2PNode, stopP2PNode } from './p2p/index.js';
import authRoutes from './routes/auth.js';
import p2pRoutes from './routes/p2p.js';
import protectedRoutes from './routes/protected.js';
import rootRoutes from './routes/root.js';

dotenv.config();

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Create Express application
const app = express();

// Configure middleware
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const hostname = new URL(origin).hostname;
      if (hostname === 'localhost') {
        // Request from localhost will pass
        callback(null, true);
        return;
      }
      // Generate an error on other origins, disabling access
      callback(new Error('Not allowed'), false);
    },
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  }),
);

// Register routes
app.use('/', rootRoutes);
app.use('/auth', authRoutes);
app.use('/api', protectedRoutes);
app.use('/api/p2p', p2pRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  },
);

// Start the server
const server = app.listen(port, host, async () => {
  console.log(`[ ready ] http://${host}:${port}`);

  // Initialize P2P node after server starts
  try {
    await initP2PNode();
    console.log('P2P node initialized successfully');
  } catch (err) {
    console.error(`Failed to initialize P2P node: ${String(err)}`);
    // Don't exit - the server can still function without P2P
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await stopP2PNode();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await stopP2PNode();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
