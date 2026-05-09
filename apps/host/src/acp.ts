import { randomBytes } from 'node:crypto';
import * as acp from '@agentclientprotocol/sdk';
import type { Stream } from '@libp2p/interface';

function toBytes(chunk: Uint8Array | { subarray(): Uint8Array }): Uint8Array {
  return chunk instanceof Uint8Array ? chunk : chunk.subarray();
}

export function libp2pStreamToAcpStream(stream: Stream): acp.Stream {
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(toBytes(chunk));
        }
      } finally {
        controller.close();
      }
    },
  });

  const writable = new WritableStream<Uint8Array>({
    async write(chunk) {
      if (!stream.send(chunk)) {
        await new Promise<void>(resolve => {
          stream.addEventListener('drain', () => resolve(), { once: true });
        });
      }
    },
    async close() {
      await stream.close();
    },
    abort(reason) {
      stream.abort(reason instanceof Error ? reason : new Error(String(reason)));
    },
  });

  return acp.ndJsonStream(writable, readable);
}

class ManagedAgent implements acp.Agent {
  private sessions = new Map<string, AbortController>();

  constructor(private readonly connection: acp.AgentSideConnection) {}

  async initialize(
    _params: acp.InitializeRequest,
  ): Promise<acp.InitializeResponse> {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    };
  }

  async newSession(
    _params: acp.NewSessionRequest,
  ): Promise<acp.NewSessionResponse> {
    const sessionId = randomBytes(16).toString('hex');
    this.sessions.set(sessionId, new AbortController());
    return { sessionId };
  }

  async authenticate(
    _params: acp.AuthenticateRequest,
  ): Promise<acp.AuthenticateResponse> {
    return {};
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: 'Host is connected and ready to run agent tasks.',
        },
      },
    });

    return { stopReason: session.signal.aborted ? 'cancelled' : 'end_turn' };
  }

  async cancel(params: acp.CancelNotification): Promise<void> {
    this.sessions.get(params.sessionId)?.abort();
  }
}

export function handleAcpStream(stream: Stream): acp.AgentSideConnection {
  const acpStream = libp2pStreamToAcpStream(stream);
  return new acp.AgentSideConnection(conn => new ManagedAgent(conn), acpStream);
}
