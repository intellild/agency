import Fastify from 'fastify';
import middie from '@fastify/middie';
import express from 'express';
import { ExpressPeerServer } from 'peer';
import { app, connectedPeers } from './app/app';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
});

void (async () => {
  await server.register(middie);

  const peerServer = ExpressPeerServer(server.server, { path: '/' });

  peerServer.on('connection', (client) => {
    const id = client.getId();
    if (!connectedPeers.includes(id)) {
      connectedPeers.push(id);
    }
  });

  peerServer.on('disconnect', (client) => {
    const id = client.getId();
    const idx = connectedPeers.indexOf(id);
    if (idx !== -1) {
      connectedPeers.splice(idx, 1);
    }
  });

  const expressApp = express();
  expressApp.use('/peerjs', peerServer);
  server.use('/', expressApp);

  // Register your application as a normal plugin.
  await server.register(app);

  // Start listening.
  server.listen({ port, host }, (err) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    } else {
      console.log(`[ ready ] http://${host}:${port}`);
    }
  });
})();
