import type { RequestHandler, Router } from 'express';
import express from 'express';
import { authenticate } from '../middleware/jwt.js';
import { getICEServers, getP2PNodeInfo } from '../p2p/index.js';

const router: Router = express.Router();

// Get P2P configuration - requires authentication
const getP2PConfig: RequestHandler = (_req, res) => {
  const p2pInfo = getP2PNodeInfo();

  if (!p2pInfo) {
    res.status(503).json({ error: 'P2P service unavailable' });
    return;
  }

  res.json({
    serverPeerId: p2pInfo.peerId,
    relayAddresses: p2pInfo.relayAddresses,
    iceServers: getICEServers(),
  });
};

router.get('/config', authenticate, getP2PConfig);

export default router;
