import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import * as dotenv from 'dotenv';
import { Octokit } from 'octokit';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from './auth/tokens.js';
import { getAgencyConfigPath, loadAgencyConfig } from './config.js';
import {
  authenticate,
  type AppVariables,
} from './http/authenticate.js';
import {
  getICEServers,
  getP2PNodeInfo,
  initP2PNode,
  stopP2PNode,
} from './p2p/index.js';
import {
  listPeers,
  registerPeer,
  removePeer,
  subscribePeers,
  type PeerType,
} from './p2p/registry.js';

dotenv.config();

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const config = loadAgencyConfig();

const myFetch: typeof undiciFetch = (url, options) => {
  return undiciFetch(url, {
    ...options,
    dispatcher: process.env.HTTPS_PROXY
      ? new ProxyAgent({
          uri: process.env.HTTPS_PROXY,
          keepAliveTimeout: 10,
          keepAliveMaxTimeout: 10,
        })
      : undefined,
  });
};

function encodeOAuthState(state: string, redirectUri: string): string {
  return Buffer.from(JSON.stringify({ state, redirectUri })).toString(
    'base64url',
  );
}

function decodeOAuthState(value: string): {
  state: string;
  redirectUri: string;
} {
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf-8'));
  if (
    typeof parsed.state !== 'string' ||
    typeof parsed.redirectUri !== 'string'
  ) {
    throw new Error('Invalid OAuth state');
  }
  return parsed;
}

function appendQuery(url: string, query: Record<string, string>): string {
  const result = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    result.searchParams.set(key, value);
  }
  return result.toString();
}

const app = new Hono<{ Variables: AppVariables }>();
const requireAuth = authenticate(config);

async function refreshTokenResponse(c: Context<{ Variables: AppVariables }>) {
  const body = (await c.req.json().catch(() => ({}))) as {
    refreshToken?: string;
    refresh_token?: string;
  };
  const refreshToken = body.refreshToken ?? body.refresh_token;

  if (!refreshToken) {
    return c.json({ error: 'Refresh token required' }, 400);
  }

  try {
    const userId = await verifyRefreshToken(config, refreshToken);
    return c.json({
      accessToken: await generateAccessToken(config, userId),
      refreshToken: await generateRefreshToken(config, userId),
      userId,
    });
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 403);
  }
}

app.use(
  '*',
  cors({
    origin: origin => {
      if (!origin) {
        return '*';
      }
      const hostname = new URL(origin).hostname;
      return hostname === 'localhost' || hostname === '127.0.0.1'
        ? origin
        : '';
    },
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  }),
);

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: 'Internal server error' }, 500);
});

app.get('/', c =>
  c.json({
    message: 'Agency API',
    configPath: getAgencyConfigPath(),
  }),
);

app.get('/oauth/github', c => {
  const redirectUri = c.req.query('redirect_uri');
  const state = c.req.query('state');

  if (!redirectUri || !state) {
    return c.json({ error: 'redirect_uri and state are required' }, 400);
  }

  if (!config.github.clientId) {
    return c.json({ error: 'GitHub client id is not configured' }, 500);
  }

  const callbackUrl = new URL('/oauth/github/callback', c.req.url).toString();
  const githubUrl = appendQuery('https://github.com/login/oauth/authorize', {
    client_id: config.github.clientId,
    redirect_uri: callbackUrl,
    state: encodeOAuthState(state, redirectUri),
    scope: 'read:user',
  });

  return c.redirect(githubUrl);
});

app.get('/oauth/github/callback', async c => {
  const code = c.req.query('code');
  const encodedState = c.req.query('state');

  if (!code || !encodedState) {
    return c.json({ error: 'Missing GitHub OAuth code or state' }, 400);
  }

  let redirectUri: string;
  let clientState: string;
  try {
    const state = decodeOAuthState(encodedState);
    redirectUri = state.redirectUri;
    clientState = state.state;
  } catch {
    return c.json({ error: 'Invalid OAuth state' }, 400);
  }

  try {
    const tokenResponse = await myFetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.github.clientId,
          client_secret: config.github.clientSecret,
          code,
        }),
      },
    );
    const tokenJson = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenJson.access_token) {
      throw new Error(
        tokenJson.error_description ||
          tokenJson.error ||
          'OAuth token exchange failed',
      );
    }

    const octokit = new Octokit({ auth: tokenJson.access_token });
    const githubUser = await octokit.rest.users.getAuthenticated();
    const username = githubUser.data.login;

    if (
      config.github.whitelist.length > 0 &&
      !config.github.whitelist
        .map(allowedUsername => allowedUsername.toLowerCase())
        .includes(username.toLowerCase())
    ) {
      return c.redirect(
        appendQuery(redirectUri, {
          error: 'not_allowed',
          state: clientState,
        }),
      );
    }

    const userId = githubUser.data.id.toString();
    const accessToken = await generateAccessToken(config, userId);
    const refreshToken = await generateRefreshToken(config, userId);

    return c.redirect(
      appendQuery(redirectUri, {
        accessToken,
        refreshToken,
        githubToken: tokenJson.access_token,
        userId,
        username,
        state: clientState,
      }),
    );
  } catch (error) {
    console.error(error);
    return c.redirect(
      appendQuery(redirectUri, {
        error: 'authentication_failed',
        state: clientState,
      }),
    );
  }
});

app.post('/auth/refresh', refreshTokenResponse);
app.post('/api/auth/refresh', refreshTokenResponse);

app.get('/api/me', requireAuth, c => {
  const user = c.get('user');
  return c.json({
    userId: user.sub,
    message: 'This is a protected endpoint',
  });
});

app.get('/api/dashboard', requireAuth, c =>
  c.json({
    userId: c.get('user').sub,
    data: 'Protected dashboard data',
  }),
);

app.get('/api/p2p/config', requireAuth, c => {
  const p2pInfo = getP2PNodeInfo();

  if (!p2pInfo) {
    return c.json({ error: 'P2P service unavailable' }, 503);
  }

  return c.json({
    serverPeerId: p2pInfo.peerId,
    relayAddresses: p2pInfo.multiaddrs,
    multiaddrs: p2pInfo.multiaddrs,
    iceServers: getICEServers(),
  });
});

app.get('/api/p2p/peers', requireAuth, c => {
  const type = c.req.query('type') as PeerType | undefined;
  if (type && type !== 'client' && type !== 'host') {
    return c.json({ error: 'Invalid peer type' }, 400);
  }
  return c.json({ peers: listPeers(type) });
});

app.get('/api/p2p/hosts', requireAuth, c =>
  c.json({ hosts: listPeers('host') }),
);

app.get('/api/p2p/events', requireAuth, c =>
  streamSSE(c, async stream => {
    const unsubscribe = subscribePeers(async peers => {
      await stream.writeSSE({
        event: 'peers',
        data: JSON.stringify({
          peers,
          hosts: peers.filter(peer => peer.type === 'host'),
        }),
      });
    });

    stream.onAbort(unsubscribe);

    while (!stream.aborted) {
      await stream.writeSSE({
        event: 'heartbeat',
        data: JSON.stringify({ now: new Date().toISOString() }),
      });
      await stream.sleep(15_000);
    }

    unsubscribe();
  }),
);

app.post('/api/p2p/peers', requireAuth, async c => {
  const body = (await c.req.json().catch(() => ({}))) as {
    peerId?: string;
    type?: PeerType;
    username?: string;
    addresses?: string[];
  };

  if (!body.peerId || (body.type !== 'client' && body.type !== 'host')) {
    return c.json({ error: 'peerId and valid type are required' }, 400);
  }

  const peer = registerPeer({
    peerId: body.peerId,
    type: body.type,
    userId: c.get('user').sub,
    username: body.username,
    addresses: body.addresses,
  });

  return c.json({ peer });
});

app.delete('/api/p2p/peers/:peerId', requireAuth, c => {
  removePeer(c.req.param('peerId'));
  return c.json({ ok: true });
});

const server = serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  async () => {
    console.log(`[ ready ] http://${host}:${port}`);

    try {
      await initP2PNode({
        wsPort: config.libp2p.wsPort,
        publicAddresses: config.libp2p.publicAddresses,
      });
      console.log('P2P node initialized successfully');
    } catch (err) {
      console.error(`Failed to initialize P2P node: ${String(err)}`);
    }
  },
);

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);
  await stopP2PNode();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
