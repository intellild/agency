import {
  AGENCY_ACP_PROTOCOL,
  type AgencyHostStatus,
} from '@agency/common';
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

class BrowserAcpClient implements acp.Client {
  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const [firstOption] = params.options;
    if (!firstOption) {
      return { outcome: { outcome: 'cancelled' } };
    }

    return {
      outcome: {
        outcome: 'selected',
        optionId: firstOption.optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    console.info('ACP session update', params);
  }

  async readTextFile(
    _params: acp.ReadTextFileRequest,
  ): Promise<acp.ReadTextFileResponse> {
    return { content: '' };
  }

  async writeTextFile(
    _params: acp.WriteTextFileRequest,
  ): Promise<acp.WriteTextFileResponse> {
    return {};
  }
}

export async function initializeHostAcpSession(
  stream: Stream,
): Promise<AgencyHostStatus> {
  const connection = new acp.ClientSideConnection(
    () => new BrowserAcpClient(),
    libp2pStreamToAcpStream(stream),
  );

  const init = await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientCapabilities: {
      fs: {
        readTextFile: true,
        writeTextFile: true,
      },
    },
  });
  const session = await connection.newSession({
    cwd: '/',
    mcpServers: [],
  });

  return {
    protocol: AGENCY_ACP_PROTOCOL,
    initialized: init.protocolVersion === acp.PROTOCOL_VERSION,
    sessionId: session.sessionId,
    message: `ACP session ${session.sessionId} initialized`,
  };
}
