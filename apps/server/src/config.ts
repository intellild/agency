import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface AgencyConfig {
  auth: {
    jwtSecret: string;
  };
  github: {
    clientId: string;
    clientSecret: string;
    whitelist: string[];
  };
  libp2p: {
    wsPort: number;
    publicAddresses: string[];
  };
}

const configPath = join(homedir(), '.agency', 'config.json');

function createDefaultConfig(): AgencyConfig {
  return {
    auth: {
      jwtSecret: process.env.ROOT_SECRET || randomBytes(32).toString('hex'),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      whitelist: process.env.GITHUB_WHITELIST
        ? process.env.GITHUB_WHITELIST.split(',').map(item => item.trim())
        : [],
    },
    libp2p: {
      wsPort: Number(process.env.P2P_WS_PORT ?? 9090),
      publicAddresses: process.env.P2P_PUBLIC_ADDRESSES
        ? process.env.P2P_PUBLIC_ADDRESSES.split(',').map(item => item.trim())
        : [],
    },
  };
}

function mergeConfig(config: Partial<AgencyConfig>): AgencyConfig {
  const defaults = createDefaultConfig();

  return {
    auth: {
      ...defaults.auth,
      ...config.auth,
    },
    github: {
      ...defaults.github,
      ...config.github,
      whitelist: config.github?.whitelist ?? defaults.github.whitelist,
    },
    libp2p: {
      ...defaults.libp2p,
      ...config.libp2p,
      publicAddresses:
        config.libp2p?.publicAddresses ?? defaults.libp2p.publicAddresses,
    },
  };
}

export function loadAgencyConfig(): AgencyConfig {
  mkdirSync(dirname(configPath), { recursive: true });

  if (!existsSync(configPath)) {
    const config = createDefaultConfig();
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    return config;
  }

  const config = mergeConfig(JSON.parse(readFileSync(configPath, 'utf-8')));
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  return config;
}

export function getAgencyConfigPath(): string {
  return configPath;
}
