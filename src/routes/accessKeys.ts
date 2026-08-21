import { Router, Request, Response } from 'express';
import { accessKeyService } from '../services';
import { config } from '../config';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';
import { z } from 'zod';
import { audit } from '../middleware/audit';
import { AccessKey, Admin } from '../models';

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
  });
  res.json(result);
});

const generateSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  connectionId: z.string().min(1).max(80).default('default'),
  serverId: z.number().int().min(1).max(4).default(1),
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
      const result = await accessKeyService.generateKey({
        phone,
        expiresInDays: req.body.expiresInDays,
        connectionId: req.body.connectionId || 'default',
        serverId: req.body.serverId,
        activate: Boolean(phone),
      });
      return res.json({ ok: true, accessKey: result.plainKey, record: result });
    }

    if (action === 'search') {
      const result = await accessKeyService.searchKeys({ search: search || phone || id || '', page: 1, limit: 100 });
      return res.json({ ok: true, keys: result.items });
    }

    if (!id) throw new Error('Access key id is required');
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

    throw new Error('Unsupported action. Use generate, search, view, assign, activate, suspend, revoke, or history.');
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message });
  }
});

router.get('/servers', authRequired, requirePermission('keys:read'), (_req: Request, res: Response) => {
  res.json({ items: accessKeyService.ACCESS_KEY_SERVERS });
});

router.post(
  '/generate',
  validateBody(generateSchema),
  async (req: Request, res: Response) => {
    if (requestHasAccessKeySecret(req)) {
      const result = await accessKeyService.generateKey({
        phone: req.body.phone,
        expiresInDays: req.body.expiresInDays,
        connectionId: req.body.connectionId,
        serverId: req.body.serverId,
        activate: true,
      });
      res.json(result);
      return;
    }

    let authPassed = false;
    authRequired(req, res, () => {
      authPassed = true;
    });
    if (!authPassed) return;

    let permissionPassed = false;
    requirePermission('keys:generate')(req, res, () => {
      permissionPassed = true;
    });
    if (!permissionPassed) return;

    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const result = await accessKeyService.generateKey({
      createdBy: admin._id,
      phone: req.body.phone,
      expiresInDays: req.body.expiresInDays,
      connectionId: req.body.connectionId,
      serverId: req.body.serverId,
      activate: Boolean(req.body.phone),
    });
    res.json(result);
  },
);

const assignSchema = z.object({
  keyId: z.string(),
  number: z.string().min(7).max(20),
  customerId: z.string().regex(/^[0-9a-fA-F]{24}$/),
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

export default router;
