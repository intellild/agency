import type { RequestHandler, Router } from 'express';
import express from 'express';
import { authenticate } from '../middleware/jwt.js';

const router: Router = express.Router();

// Protected route example - requires authentication
const getMe: RequestHandler = (req, res) => {
  res.json({
    userId: req.user?.sub,
    message: 'This is a protected endpoint',
  });
};

// Protected dashboard data
const getDashboard: RequestHandler = (req, res) => {
  res.json({
    userId: req.user?.sub,
    data: 'Protected dashboard data',
  });
};

router.get('/me', authenticate, getMe);
router.get('/dashboard', authenticate, getDashboard);

export default router;
