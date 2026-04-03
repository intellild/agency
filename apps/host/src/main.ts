import { PeerJSNativeClient } from './peerjs-native-client';

const client = new PeerJSNativeClient({
  host: 'localhost',
  port: 3000,
  path: '/peerjs',
});

client
  .connect()
  .then((id) => {
    console.log(`Host connected to PeerJS server with ID: ${id}`);
  })
  .catch((err) => {
    console.error('PeerJS connection error:', err.message);
  });
