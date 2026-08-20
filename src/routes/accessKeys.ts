import { Router, Request, Response } from 'express';
import { accessKeyService } from '../services';
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

router.post(
  '/generate',
  authRequired,
  requirePermission('keys:generate'),
  audit('KEY_CREATED', 'access_key'),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const result = await accessKeyService.generateKey(admin._id);
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
