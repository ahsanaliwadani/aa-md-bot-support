import { Router, Request, Response } from 'express';
import { accessKeyService } from '../services';
import { config } from '../config';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';
import { z } from 'zod';
import { audit } from '../middleware/audit';
import { Admin } from '../models';

const router = Router();

router.get(
  '/',
  authRequired,
  requirePermission('keys:read'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    const result = await accessKeyService.searchKeys({
      search: req.query.search as string,
      status: req.query.status as string,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  },
);

const generateSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  connectionId: z.string().min(1).max(80).default('default'),
  serverId: z.number().int().min(1).max(4).default(1),
});

function requestHasAccessKeySecret(req: Request): boolean {
  if (!config.accessKeySecret) return false;
  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const alternate = req.get('x-access-key-secret') || '';
  return bearer === config.accessKeySecret || alternate === config.accessKeySecret;
}

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
