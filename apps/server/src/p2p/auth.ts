import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type {
  ConnectionGater,
  MultiaddrConnection,
  PeerId,
} from '@libp2p/interface';
import { importSPKI, jwtVerify } from 'jose';

// Load public key for JWT verification
function loadPublicKey(): string {
  const env = process.env.ENV ?? 'development';
  const keyPath = path.join(__dirname, '../../keys', env, 'public.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf-8');
  }
  return process.env.JWT_PUBLIC_KEY || '';
}

export interface P2PAuthConfig {
  maxConnectionsPerUser: number;
  onAuthFailure?: (peerId: string, reason: string) => void;
  onConnectionClosed?: (peerId: string, userId: string) => void;
}

interface ConnectionInfo {
  peerId: string;
  userId: string;
  token: string;
  connectedAt: Date;
  expiresAt: Date;
}

interface ReservationInfo {
  peerId: string;
  userId: string;
  reservedAt: Date;
  expiresAt: Date;
}

export class P2PAuth {
  private connections = new Map<string, ConnectionInfo>(); // peerId -> ConnectionInfo
  private userConnections = new Map<string, Set<string>>(); // userId -> Set<peerId>
  private reservations = new Map<string, ReservationInfo>(); // peerId -> ReservationInfo
  private userReservations = new Map<string, Set<string>>(); // userId -> Set<peerId>
  private config: P2PAuthConfig;
  private publicKey: string;

  constructor(config: P2PAuthConfig) {
    this.config = config;
    this.publicKey = loadPublicKey();
  }

  /**
   * Extract and verify access token from connection
   * The token should be passed in the connection's metadata during Noise handshake
   */
  async verifyConnectionToken(
    maConn: MultiaddrConnection,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    try {
      // Extract token from connection metadata/tags
      // In libp2p with Noise, custom data can be passed during handshake
      const token = this.extractTokenFromConnection(maConn);

      if (!token) {
        return null;
      }

      return await this.verifyToken(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract token from connection metadata
   * This relies on the Noise protocol handshake data
   */
  private extractTokenFromConnection(
    maConn: MultiaddrConnection,
  ): string | null {
    // Try to get token from connection's early data or metadata
    // This is implementation-specific based on how the client sends the token

    // Look for token in connection's transient data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = maConn as any;

    // Check various possible locations for the token
    if (conn.token) {
      return conn.token as string;
    }

    if (conn.metadata?.token) {
      return conn.metadata.token as string;
    }

    // The token might be in the Noise handshake early data
    if (conn.encryptedConnection?.handshakeData?.token) {
      return conn.encryptedConnection.handshakeData.token as string;
    }

    return null;
  }

  /**
   * Verify JWT access token
   */
  async verifyToken(
    token: string,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    try {
      if (!this.publicKey) {
        throw new Error('Public key not configured for JWT verification');
      }

      const publicKey = await importSPKI(this.publicKey, 'RS256');
      const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ['RS256'],
      });

      // Check token type
      if (payload.type !== 'access') {
        return null;
      }

      const userId = payload.sub;
      if (!userId) {
        return null;
      }

      const expiresAt = payload.exp
        ? new Date(payload.exp * 1000)
        : new Date(Date.now() + 86400000);

      return { userId, expiresAt };
    } catch (error) {
      return null;
    }
  }

  /**
   * Register a new connection after successful auth
   */
  registerConnection(
    peerId: string,
    userId: string,
    token: string,
    expiresAt: Date,
  ): boolean {
    // Check connection limit per user
    const userConns = this.userConnections.get(userId);
    if (userConns && userConns.size >= this.config.maxConnectionsPerUser) {
      return false;
    }

    const connInfo: ConnectionInfo = {
      peerId,
      userId,
      token,
      connectedAt: new Date(),
      expiresAt,
    };

    this.connections.set(peerId, connInfo);

    if (!userConns) {
      this.userConnections.set(userId, new Set([peerId]));
    } else {
      userConns.add(peerId);
    }

    // Set up expiration check
    this.scheduleExpirationCheck(peerId, expiresAt);

    return true;
  }

  /**
   * Remove a connection
   */
  removeConnection(peerId: string): void {
    const connInfo = this.connections.get(peerId);
    if (connInfo) {
      this.connections.delete(peerId);

      const userConns = this.userConnections.get(connInfo.userId);
      if (userConns) {
        userConns.delete(peerId);
        if (userConns.size === 0) {
          this.userConnections.delete(connInfo.userId);
        }
      }

      this.config.onConnectionClosed?.(peerId, connInfo.userId);
    }

    // Also clean up any reservation
    this.removeReservation(peerId);
  }

  /**
   * Validate an incoming connection
   * Called when a peer connects
   */
  validateConnection(maConn: MultiaddrConnection): boolean {
    // Get remote peer info from the connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remotePeer = (maConn as any).remotePeer;
    if (!remotePeer) {
      return false;
    }
    const peerId = remotePeer.toString();

    // Check if already registered
    if (this.connections.has(peerId)) {
      return true;
    }

    // For relay connections, check if there's a valid reservation
    if (this.reservations.has(peerId)) {
      const reservation = this.reservations.get(peerId)!;
      if (reservation.expiresAt > new Date()) {
        return true;
      }
      // Expired reservation
      this.removeReservation(peerId);
      return false;
    }

    // New connection - needs to be authenticated via token exchange
    // The actual auth happens in the protocol handlers
    // For now, allow the connection and wait for auth protocol
    return true;
  }

  /**
   * Register a relay reservation
   */
  registerReservation(
    peerId: string,
    userId: string,
    expiresAt: Date,
  ): boolean {
    // Check reservation limit per user
    const userResvs = this.userReservations.get(userId);
    if (userResvs && userResvs.size >= this.config.maxConnectionsPerUser) {
      return false;
    }

    const resvInfo: ReservationInfo = {
      peerId,
      userId,
      reservedAt: new Date(),
      expiresAt,
    };

    this.reservations.set(peerId, resvInfo);

    if (!userResvs) {
      this.userReservations.set(userId, new Set([peerId]));
    } else {
      userResvs.add(peerId);
    }

    return true;
  }

  /**
   * Remove a reservation
   */
  removeReservation(peerId: string): void {
    const resvInfo = this.reservations.get(peerId);
    if (resvInfo) {
      this.reservations.delete(peerId);

      const userResvs = this.userReservations.get(resvInfo.userId);
      if (userResvs) {
        userResvs.delete(peerId);
        if (userResvs.size === 0) {
          this.userReservations.delete(resvInfo.userId);
        }
      }
    }
  }

  /**
   * Validate a relay reservation request
   */
  async validateReservation(
    token: string,
    peerId: string,
  ): Promise<{ valid: boolean; userId?: string; reason?: string }> {
    const result = await this.verifyToken(token);

    if (!result) {
      return { valid: false, reason: 'Invalid or expired token' };
    }

    const { userId, expiresAt } = result;

    // Check if user has reached reservation limit
    const userResvs = this.userReservations.get(userId);
    if (userResvs && userResvs.size >= this.config.maxConnectionsPerUser) {
      return { valid: false, reason: 'Reservation limit exceeded' };
    }

    // Register the reservation
    this.registerReservation(peerId, userId, expiresAt);

    return { valid: true, userId };
  }

  /**
   * Get connection count for a user
   */
  getConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size ?? 0;
  }

  /**
   * Get reservation count for a user
   */
  getReservationCount(userId: string): number {
    return this.userReservations.get(userId)?.size ?? 0;
  }

  /**
   * Schedule a check to close connections when token expires
   */
  private scheduleExpirationCheck(peerId: string, expiresAt: Date): void {
    const now = Date.now();
    const expiresIn = expiresAt.getTime() - now;

    if (expiresIn <= 0) {
      // Already expired
      this.removeConnection(peerId);
      return;
    }

    // Schedule expiration check
    setTimeout(() => {
      const conn = this.connections.get(peerId);
      if (conn && conn.expiresAt <= new Date()) {
        this.removeConnection(peerId);
      }
    }, expiresIn);
  }

  /**
   * Check if a peer has a valid reservation or connection
   */
  isAuthorized(peerId: string): boolean {
    // Check active connection
    if (this.connections.has(peerId)) {
      const conn = this.connections.get(peerId)!;
      if (conn.expiresAt > new Date()) {
        return true;
      }
      // Expired
      this.removeConnection(peerId);
    }

    // Check active reservation
    if (this.reservations.has(peerId)) {
      const resv = this.reservations.get(peerId)!;
      if (resv.expiresAt > new Date()) {
        return true;
      }
      // Expired
      this.removeReservation(peerId);
    }

    return false;
  }
}

/**
 * Create a connection gater for libp2p
 * This enforces auth at the connection level
 */
export function createConnectionGater(p2pAuth: P2PAuth): ConnectionGater {
  return {
    denyInboundConnection: async (_maConn: MultiaddrConnection) => {
      // Allow all inbound connections initially
      // Auth will be checked after connection is established
      return false;
    },
    denyOutboundConnection: async (
      _peerId: PeerId,
      _maConn: MultiaddrConnection,
    ) => {
      return false;
    },
    denyInboundEncryptedConnection: async (
      peerId: PeerId,
      _maConn: MultiaddrConnection,
    ) => {
      // Check auth after encryption is established
      const isAuthorized = p2pAuth.isAuthorized(peerId.toString());
      return !isAuthorized;
    },
    denyOutboundEncryptedConnection: async (
      _peerId: PeerId,
      _maConn: MultiaddrConnection,
    ) => {
      return false;
    },
    denyInboundUpgradedConnection: async (
      peerId: PeerId,
      _maConn: MultiaddrConnection,
    ) => {
      const isAuthorized = p2pAuth.isAuthorized(peerId.toString());
      return !isAuthorized;
    },
    denyOutboundUpgradedConnection: async (
      _peerId: PeerId,
      _maConn: MultiaddrConnection,
    ) => {
      return false;
    },
  };
}
