import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';
import { createLibp2p } from 'libp2p';
import { handleAcpStream } from './acp.js';

const AGENCY_ACP_PROTOCOL = '/agency/acp/1.0.0';

interface P2PConfig {
  serverPeerId: string;
  relayAddresses: string[];
  multiaddrs: string[];
}

const serverUrl = process.env.AGENCY_SERVER_URL ?? 'http://localhost:3000';
const accessToken = process.env.AGENCY_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error('AGENCY_ACCESS_TOKEN is required to start host');
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path, serverUrl), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function main() {
  const config = await api<P2PConfig>('/api/p2p/config');
  const relayAddresses = config.relayAddresses.length
    ? config.relayAddresses
    : config.multiaddrs;
  const [relayAddress] = relayAddresses;

  if (!relayAddress) {
    throw new Error('Server does not expose any libp2p relay address');
  }

  const node = await createLibp2p({
    transports: [webSockets(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
    },
  });

  await node.start();
  await node.handle(AGENCY_ACP_PROTOCOL, stream => {
    handleAcpStream(stream);
  });
  await node.dial(multiaddr(relayAddress));

  const relayPeerAddress = `${relayAddress}/p2p-circuit/p2p/${node.peerId.toString()}`;

  async function register() {
    await api('/api/p2p/peers', {
      method: 'POST',
      body: JSON.stringify({
        peerId: node.peerId.toString(),
        type: 'host',
        addresses: [
          relayPeerAddress,
          ...node.getMultiaddrs().map(addr => addr.toString()),
        ],
      }),
    });
  }

  await register();
  const interval = setInterval(register, 10_000);

  console.log(`Host peer started: ${node.peerId.toString()}`);
  console.log(`Relay address: ${relayPeerAddress}`);

  async function shutdown(signal: string) {
    console.log(`${signal} received, shutting down host`);
    clearInterval(interval);
    await api(`/api/p2p/peers/${node.peerId.toString()}`, {
      method: 'DELETE',
    }).catch(() => undefined);
    await node.stop();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
