# Agency

Agency is an Nx monorepo for a distributed AI agent management system.

The system has three runtime pieces:

- `server`: Hono HTTP API, GitHub OAuth, auth token issuing, libp2p circuit relay, and peer registry.
- `client`: Modern.js + React dashboard for login, host discovery, and host connection.
- `host`: local agent runtime that connects to the server relay and exposes an Agent Client Protocol endpoint over libp2p.

## Prerequisites

- Node.js 20+
- pnpm
- A GitHub OAuth app

Install dependencies from the repository root:

```sh
pnpm install
```

Use Nx through pnpm:

```sh
pnpm nx show projects
```

## Configure Server

The server reads `~/.agency/config.json` on startup. If the file does not exist, it is created automatically.

Example:

```json
{
  "auth": {
    "jwtSecret": "replace-with-a-long-random-secret"
  },
  "github": {
    "clientId": "your_github_oauth_client_id",
    "clientSecret": "your_github_oauth_client_secret",
    "whitelist": ["your-github-login"]
  },
  "libp2p": {
    "wsPort": 9090,
    "publicAddresses": [
      "/dns4/relay.example.com/tcp/9090/wss/p2p/<server-peer-id>"
    ]
  }
}
```

For local development, `publicAddresses` can be empty. The server will expose `127.0.0.1` relay addresses to clients.

GitHub OAuth app settings:

- Authorization callback URL: `http://localhost:3000/oauth/github/callback`
- For deployed servers, use `https://your-server.example.com/oauth/github/callback`

The client does not need a GitHub client id. It only needs the server address.

## Run Locally

Start the server:

```sh
pnpm nx serve server
```

Start the client:

```sh
pnpm nx serve client
```

Open the client, enter the server address, for example:

```text
http://localhost:3000
```

Sign in with GitHub. The server owns the OAuth flow:

1. Client opens `SERVER/oauth/github`.
2. Server redirects to GitHub.
3. GitHub redirects back to `SERVER/oauth/github/callback`.
4. Server validates the GitHub user against the whitelist.
5. Server redirects back to the client callback with auth tokens in the query string.

## Run a Host

A host needs the server URL and an access token issued by login.

```sh
AGENCY_SERVER_URL=http://localhost:3000 \
AGENCY_ACCESS_TOKEN=<access-token> \
pnpm nx serve host
```

The host will:

- Fetch libp2p relay addresses from `GET /api/p2p/config`.
- Connect to the server relay.
- Register itself as a `host` with `POST /api/p2p/peers`.
- Refresh its registration periodically.
- Expose `/agency/acp/1.0.0` over libp2p for Agent Client Protocol sessions.

## Dashboard

After login, the dashboard:

- Connects to the server relay using libp2p.
- Registers itself as a `client`.
- Subscribes to `GET /api/p2p/events` for realtime peer updates.
- Shows online hosts from the server registry.
- Connects to a selected host and initializes an ACP session over libp2p.

## HTTP API

Unauthenticated:

- `GET /`
- `GET /oauth/github`
- `GET /oauth/github/callback`
- `POST /auth/refresh`

Authenticated:

- `GET /api/me`
- `GET /api/dashboard`
- `GET /api/p2p/config`
- `GET /api/p2p/peers`
- `GET /api/p2p/hosts`
- `GET /api/p2p/events`
- `POST /api/p2p/peers`
- `DELETE /api/p2p/peers/:peerId`

Use `Authorization: Bearer <access-token>` for authenticated APIs. The SSE endpoint also accepts `access_token` in the query string because browser `EventSource` cannot set custom headers.

## Build and Check

```sh
pnpm nx build server
pnpm nx build client
pnpm nx build @agency/host
pnpm biome check .
```

Format changed files:

```sh
pnpm biome check --write <file-path>
```

## Notes

- Do not connect this workspace to Nx Cloud. `neverConnectToCloud` is configured.
- Use `pnpm nx ...`, not global `nx` or `npx nx`.
- Node.js built-in imports must use the `node:` prefix.
