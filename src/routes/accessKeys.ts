import { Router, Request, Response } from 'express';
import { accessKeyService } from '../services';
import { config } from '../config';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';
import { z } from 'zod';
import { audit } from '../middleware/audit';
import { AccessKey, Admin } from '../models';
import { hashKey, maskKey } from '../utils/crypto';
import { findOrCreateUser } from '../services/user';
import { phoneToJid } from '../utils/phone';
import { getRemoteServer, remoteGenerateKey } from '../services/remoteBotClient';

const router = Router();

router.get('/', async (req: Request, res: Response, next) => {
  if (requestHasEndpointSecret(req)) {
    try {
      const id = req.query.id as string;
      if (id) return res.json({ ok: true, record: await serializeAccessKey(id) });
      const result = await accessKeyService.searchKeys({
        search: (req.query.search as string) || '',
        status: req.query.status as string,
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 100, 100),
        includeRevoked: true,
      });
      return res.json({ ok: true, keys: result.items });
    } catch (err) {
      return res.status(404).json({ ok: false, error: (err as Error).message });
    }
  }
  return next();
}, authRequired, requirePermission('keys:read'), validateQuery(paginationSchema), async (req: Request, res: Response) => {
  const result = await accessKeyService.searchKeys({
    search: req.query.search as string,
    status: req.query.status as string,
    page: Number(req.query.page),
    limit: Number(req.query.limit),
    includeRevoked: false,
  });
  res.json(result);
});

const generateSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  connectionId: z.string().min(1).max(80).default('default'),
  serverId: z.number().int().min(1).max(4).default(1),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  expiresAt: z.string().datetime().optional(),
  createdBy: z.string().min(1).max(64).optional(),
}).refine((data) => !(data.expiresInDays && data.expiresAt), {
  message: 'Use either expiresInDays or expiresAt, not both',
});

function hasHeaderSecret(req: Request, secret: string): boolean {
  if (!secret) return false;
  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const alternate = req.get('x-access-key-secret') || '';
  return bearer === secret || alternate === secret;
}

function requestHasAccessKeySecret(req: Request): boolean {
  return hasHeaderSecret(req, config.accessKeySecret);
}

function requestHasEndpointSecret(req: Request): boolean {
  return hasHeaderSecret(req, config.accessKeyEndpointSecret);
}

function requestHasIntegrationSecret(req: Request): boolean {
  return requestHasEndpointSecret(req);
}

function requireSecureAccessKeyEndpoint(req: Request, res: Response): boolean {
  if (!config.accessKeyEndpointSecret) {
    res.status(403).json({ ok: false, error: 'ACCESS_KEY_ENDPOINT_SECRET is not configured' });
    return false;
  }
  if (!requestHasEndpointSecret(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

function resolveExpiry(expiresInDays?: unknown, expiresAt?: unknown): Date | undefined {
  if (expiresAt) {
    const value = new Date(String(expiresAt));
    if (Number.isNaN(value.getTime()) || value <= new Date()) throw new Error('expiresAt must be a future ISO-8601 date');
    return value;
  }
  if (expiresInDays !== undefined) {
    const days = Number(expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('expiresInDays must be an integer between 1 and 3650');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/[^0-9]/g, '');
}

async function serializeAccessKey(id: string) {
  const key = await AccessKey.findOne({ keyId: id })
    .populate('customerId', 'customerId phoneNumber country')
    .populate('createdBy', 'name email');
  if (!key) throw new Error('Access key not found');
  return key;
}

router.get('/history', async (req: Request, res: Response) => {
  if (!requireSecureAccessKeyEndpoint(req, res)) return;
  try {
    const id = req.query.id as string;
    if (!id) throw new Error('Access key id is required');
    const key = await AccessKey.findOne({ keyId: id }).select('keyId history');
    if (!key) throw new Error('Access key not found');
    res.json({ ok: true, history: key.history });
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message });
  }
});

router.post('/action', async (req: Request, res: Response) => {
  if (!requireSecureAccessKeyEndpoint(req, res)) return;
  try {
    const action = String(req.body.action || '').toLowerCase();
    const id = req.body.id || req.body.keyId;
    const phone = req.body.phone;
    const search = req.body.search || '';
    const createdBy = String(req.body.createdBy || 'secure-api').slice(0, 64);

    if (action === 'generate') {
      const expiresAt = resolveExpiry(req.body.expiresInDays, req.body.expiresAt);
      const result = await accessKeyService.generateKey({
        phone,
        connectionId: req.body.connectionId || 'default',
        serverId: req.body.serverId,
        activate: Boolean(phone),
        expiresAt,
      });
      return res.json({ ok: true, accessKey: result.plainKey, record: result });
    }

    if (action === 'search') {
      const result = await accessKeyService.searchKeys({ search: search || phone || id || '', page: 1, limit: 100, includeRevoked: true });
      return res.json({ ok: true, keys: result.items });
    }

    if (!id) throw new Error('Access key id is required');
    if (action === 'delete') {
      const key = await accessKeyService.deleteKey(String(id));
      if (!key) throw new Error('Access key not found');
      return res.json({ ok: true, deleted: true, id: key._id.toString(), keyId: key.keyId });
    }
    if (action === 'view') return res.json({ ok: true, record: await serializeAccessKey(id) });
    if (action === 'history') {
      const key = await AccessKey.findOne({ keyId: id }).select('keyId history');
      if (!key) throw new Error('Access key not found');
      return res.json({ ok: true, history: key.history });
    }
    if (action === 'assign') {
      const key = await AccessKey.findOne({ keyId: id });
      if (!key) throw new Error('Access key not found');
      key.assignedNumber = String(phone || '').replace(/[^0-9]/g, '');
      key.history.push({ action: 'KEY_ASSIGNED', at: new Date(), detail: `Assigned through ${createdBy}` });
      await key.save();
      return res.json({ ok: true, record: key });
    }
    if (action === 'activate') return res.json({ ok: true, record: await accessKeyService.activateKey(id) });
    if (action === 'suspend' || action === 'disable') return res.json({ ok: true, record: await accessKeyService.suspendKey(id, `Suspended through ${createdBy}`) });
    if (action === 'revoke') return res.json({ ok: true, record: await accessKeyService.revokeKey(id, `Revoked through ${createdBy}`) });

    throw new Error('Unsupported action. Use generate, search, view, assign, activate, suspend, revoke, delete, or history.');
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message });
  }
});

router.get('/servers', authRequired, requirePermission('keys:read'), (_req: Request, res: Response) => {
  res.json({ items: accessKeyService.ACCESS_KEY_SERVERS });
});

/**
 * Saves a local copy of a key that was actually created on a remote bot VM,
 * so the dashboard table/history can show it. The remote bot VM remains the
 * source of truth for verification — this record is for admin visibility only.
 */
async function mirrorRemoteKey(
  server: { id: number; name: string; url: string },
  remote: { accessKey?: string; record?: { id: string; assignedPhone?: string; status: string; activatedAt: number | null; expiresAt: number | null } },
  connectionId: string | undefined,
  createdBy: unknown,
) {
  const plain = remote.accessKey!;
  const record = remote.record!;
  const phone = normalizePhone(record.assignedPhone);
  const status = (record.status || 'active').toUpperCase();

  const keyId = `AK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const key = await AccessKey.create({
    keyId,
    keyHash: hashKey(plain),
    displayId: maskKey(plain),
    assignedNumber: phone,
    status,
    createdBy,
    activatedAt: record.activatedAt ? new Date(record.activatedAt) : (status === 'ACTIVE' ? new Date() : undefined),
    expiresAt: record.expiresAt ? new Date(record.expiresAt) : undefined,
    serverId: server.id,
    serverName: server.name,
    serverUrl: server.url,
    connectionId: connectionId || 'default',
    history: [
      {
        action: 'KEY_CREATED',
        at: new Date(),
        detail: `Generated on ${server.name} via remote bot API (remote id: ${record.id})`,
      },
    ],
  });

  if (phone) {
    const user = await findOrCreateUser(phoneToJid(phone));
    key.customerId = user._id;
    await key.save();
  }

  return {
    id: key._id.toString(),
    keyId: key.keyId,
    plainKey: plain,
    displayId: key.displayId,
    server,
    phone,
    expiresAt: key.expiresAt,
    connectionId: key.connectionId,
    status: key.status,
  };
}

router.post(
  '/generate',
  validateBody(generateSchema),
  async (req: Request, res: Response) => {
    const server = getRemoteServer(req.body.serverId);

    // Secret-header path (SSH script / internal integrations)
    if (requestHasEndpointSecret(req)) {
      try {
        const remote = await remoteGenerateKey(server, {
          phone: req.body.phone,
          connectionId: req.body.connectionId,
          expiresInDays: req.body.expiresInDays,
          expiresAt: req.body.expiresAt,
          createdBy: 'integration-api',
        });
        const mirrored = await mirrorRemoteKey(server, remote, req.body.connectionId, undefined);
        return res.json(mirrored);
      } catch (err) {
        return res.status(502).json({ error: (err as Error).message });
      }
    }

    // Admin dashboard path — now calls the real bot VM instead of
    // writing straight to this app's own MongoDB.
    let authPassed = false;
    authRequired(req, res, () => { authPassed = true; });
    if (!authPassed) return;

    let permissionPassed = false;
    requirePermission('keys:generate')(req, res, () => { permissionPassed = true; });
    if (!permissionPassed) return;

    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    try {
      const remote = await remoteGenerateKey(server, {
        phone: req.body.phone,
        connectionId: req.body.connectionId,
        expiresInDays: req.body.expiresInDays,
        expiresAt: req.body.expiresAt,
        createdBy: admin.email,
      });
      const mirrored = await mirrorRemoteKey(server, remote, req.body.connectionId, admin._id);
      res.json(mirrored);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  },
);

const assignSchema = z.object({
  keyId: z.string(),
  number: z.string().min(7).max(20),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

const assignPhoneSchema = z.object({
  keyId: z.string(),
  phone: z.string().min(7).max(20),
});

router.post(
  '/assign',
  authRequired,
  requirePermission('keys:assign'),
  audit('KEY_ASSIGNED', 'access_key'),
  validateBody(assignSchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const key = await accessKeyService.assignKey(
      req.body.keyId,
      req.body.number,
      req.body.customerId,
      admin._id,
    );
    if (!key) {
      res.status(400).json({ error: 'Key not found or not in PENDING status' });
      return;
    }
    res.json({ key });
  },
);

router.post(
  '/assign-phone',
  authRequired,
  requirePermission('keys:assign'),
  audit('KEY_ASSIGNED_TO_PHONE', 'access_key'),
  validateBody(assignPhoneSchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const key = await accessKeyService.assignKeyToPhone(req.body.keyId, req.body.phone, admin._id);
    if (!key) {
      res.status(400).json({ error: 'Key not found or not in PENDING status' });
      return;
    }
    res.json({ key });
  },
);

const keyActionSchema = z.object({
  keyId: z.string(),
  reason: z.string().min(1).max(500).optional(),
});

router.post(
  '/activate',
  authRequired,
  requirePermission('keys:activate'),
  audit('KEY_ACTIVATED', 'access_key'),
  validateBody(keyActionSchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const key = await accessKeyService.activateKey(req.body.keyId, admin._id);
    if (!key) {
      res.status(400).json({ error: 'Key not found or cannot be activated' });
      return;
    }
    res.json({ key });
  },
);

router.post(
  '/suspend',
  authRequired,
  requirePermission('keys:suspend'),
  audit('KEY_SUSPENDED', 'access_key'),
  validateBody(keyActionSchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const key = await accessKeyService.suspendKey(
      req.body.keyId,
      req.body.reason || 'Suspended by admin',
      admin._id,
    );
    if (!key) {
      res.status(400).json({ error: 'Key not found' });
      return;
    }
    res.json({ key });
  },
);

router.post(
  '/reactivate',
  authRequired,
  requirePermission('keys:activate'),
  audit('KEY_REACTIVATED', 'access_key'),
  validateBody(z.object({ keyId: z.string() })),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const key = await accessKeyService.reactivateKey(req.body.keyId, admin._id);
    if (!key) {
      res.status(400).json({ error: 'Key not found or not suspended' });
      return;
    }
    res.json({ key });
  },
);

router.post(
  '/revoke',
  authRequired,
  requirePermission('keys:revoke'),
  audit('KEY_REVOKED', 'access_key'),
  validateBody(keyActionSchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const key = await accessKeyService.revokeKey(
      req.body.keyId,
      req.body.reason || 'Revoked by admin',
      admin._id,
    );
    if (!key) {
      res.status(400).json({ error: 'Key not found' });
      return;
    }
    res.json({ key });
  },
);

router.delete(
  '/:keyId',
  authRequired,
  requirePermission('keys:revoke'),
  audit('KEY_DELETED', 'access_key'),
  async (req: Request, res: Response) => {
    const key = await accessKeyService.deleteKey(req.params.keyId);
    if (!key) {
      res.status(404).json({ error: 'Access key not found' });
      return;
    }
    res.json({ success: true });
  },
);

export default router;
