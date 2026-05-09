export type PeerType = 'client' | 'host';

export interface RegisteredPeer {
  peerId: string;
  type: PeerType;
  userId: string;
  username?: string;
  addresses: string[];
  connectedAt: string;
  updatedAt: string;
}

const peers = new Map<string, RegisteredPeer>();
const subscribers = new Set<(peers: RegisteredPeer[]) => void | Promise<void>>();

function notifySubscribers(): void {
  const snapshot = listPeers();
  for (const subscriber of subscribers) {
    void subscriber(snapshot);
  }
}

export function registerPeer(input: {
  peerId: string;
  type: PeerType;
  userId: string;
  username?: string;
  addresses?: string[];
}): RegisteredPeer {
  const now = new Date().toISOString();
  const existing = peers.get(input.peerId);
  const peer: RegisteredPeer = {
    peerId: input.peerId,
    type: input.type,
    userId: input.userId,
    username: input.username,
    addresses: input.addresses ?? [],
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
  };

  peers.set(input.peerId, peer);
  notifySubscribers();
  return peer;
}

export function removePeer(peerId: string): void {
  if (peers.delete(peerId)) {
    notifySubscribers();
  }
}

export function listPeers(type?: PeerType): RegisteredPeer[] {
  return [...peers.values()]
    .filter(peer => !type || peer.type === type)
    .sort((a, b) => a.connectedAt.localeCompare(b.connectedAt));
}

export function subscribePeers(
  subscriber: (peers: RegisteredPeer[]) => void | Promise<void>,
): () => void {
  subscribers.add(subscriber);
  void subscriber(listPeers());

  return () => {
    subscribers.delete(subscriber);
  };
}
