import axios from 'axios';
import { PeerJSNativeClient } from '../support/peerjs-native-client';

describe('GET /', () => {
  it('should return a message', async () => {
    const res = await axios.get(`/`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Hello API' });
  });
});

describe('PeerJS', () => {
  it('should connect via native WebSocket and receive a peer id', async () => {
    const client = new PeerJSNativeClient({
      host: 'localhost',
      port: 3000,
      path: '/peerjs',
    });

    const id = await client.connect();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    client.disconnect();
  });
});
