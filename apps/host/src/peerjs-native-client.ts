import WebSocket from 'ws';
import http from 'http';

export interface PeerJSNativeClientOptions {
  host: string;
  port: number;
  path: string;
}

export class PeerJSNativeClient {
  private ws: WebSocket | null = null;
  private id: string | null = null;

  constructor(private readonly options: PeerJSNativeClientOptions) {}

  async connect(): Promise<string> {
    this.id = await this._getPeerId();
    const token = Math.random().toString(36).substring(2);
    const wsPath = `${this.options.path}${this.options.path.endsWith('/') ? '' : '/'}peerjs`;
    const wsUrl = `ws://${this.options.host}:${this.options.port}${wsPath}?key=peerjs&id=${this.id}&token=${token}`;

    this.ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('WebSocket not initialized'));

      this.ws.once('open', () => {
        resolve(this.id as string);
      });

      this.ws.once('error', (err) => {
        reject(err);
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private _getPeerId(): Promise<string> {
    return new Promise((resolve, reject) => {
      const ts = Date.now() + Math.random();
      const url = `http://${this.options.host}:${this.options.port}${this.options.path}${this.options.path.endsWith('/') ? '' : '/'}peerjs/id?ts=${ts}`;

      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', reject);
    });
  }
}
