import { config } from '../config';

export interface RemoteServer {
  id: number;
  name: string;
  url: string;
}

export function getRemoteServer(serverId?: number): RemoteServer {
  return (
    config.accessKeyServers.find((s) => s.id === serverId) ||
    config.accessKeyServers[0]
  );
}

export interface RemoteGenerateInput {
  phone?: string;
  connectionId?: string;
  expiresInDays?: number;
  expiresAt?: string;
  createdBy?: string;
}

export interface RemoteAccessKeyRecord {
  id: string;
  plainKey: string;
  assignedPhone?: string;
  status: string;
  createdAt: number;
  activatedAt: number | null;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
  createdBy?: string;
  connectionId: string;
  history: unknown[];
}

export interface RemoteGenerateResponse {
  ok: boolean;
  accessKey?: string;
  record?: RemoteAccessKeyRecord;
  error?: string;
}

/**
 * Calls the real WhatsApp bot on the given server so the key actually
 * exists where verification happens — mirrors what
 * scripts/generate-access-key.sh does over SSH.
 */
export async function remoteGenerateKey(
  server: RemoteServer,
  input: RemoteGenerateInput,
): Promise<RemoteGenerateResponse> {
  let res: Response;
  try {
    res = await fetch(`${server.url.replace(/\/$/, '')}/api/access-keys/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key-Secret': config.accessKeyEndpointSecret,
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new Error(`Could not reach ${server.name} (${server.url}): ${(err as Error).message}`);
  }

  const data = (await res.json().catch(() => ({}))) as RemoteGenerateResponse;

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `${server.name} rejected the request (HTTP ${res.status})`);
  }

  return data;
}
