import type { MiddlewareHandler } from 'hono';
import type { AgencyConfig } from '../config.js';
import { verifyAccessToken, type AuthUser } from '../auth/tokens.js';

export type AppVariables = {
  user: AuthUser;
};

export function authenticate(config: AgencyConfig): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  return async (c, next) => {
    const authHeader = c.req.header('authorization');
    const queryToken = c.req.query('access_token');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : queryToken;

    if (!token) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    try {
      const user = await verifyAccessToken(config, token);
      c.set('user', user);
      await next();
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Invalid token' },
        401,
      );
    }
  };
}
