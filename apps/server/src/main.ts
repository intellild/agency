import cors from '@fastify/cors';
import * as dotenv from 'dotenv';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { app } from './app/app';

dotenv.config();

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
});

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);
server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(new Error('Not allowed'), false);
      return;
    }
    const hostname = new URL(origin).hostname;
    if (hostname === 'localhost') {
      //  Request from localhost will pass
      cb(null, true);
      return;
    }
    // Generate an error on other origins, disabling access
    cb(new Error('Not allowed'), false);
  },
});

// Register your application as a normal plugin.
server.register(app);

// Start listening.
server.listen({ port, host }, err => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    console.log(`[ ready ] http://${host}:${port}`);
  }
});
