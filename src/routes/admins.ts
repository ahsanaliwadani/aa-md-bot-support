import { Router, Request, Response } from 'express';
import { authService } from '../services';
import { Admin } from '../models';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { z } from 'zod';
import { audit } from '../middleware/audit';

const router = Router();

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'SUPPORT']),
});

router.post(
  '/',
  authRequired,
  requirePermission('admins:write'),
  audit('ADMIN_CREATED', 'admin'),
  validateBody(createAdminSchema),
  async (req: Request, res: Response) => {
    try {
      const admin = await authService.createAdmin(req.body);
      const { passwordHash, ...safe } = admin.toObject();
      res.json({ admin: safe });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  },
);

router.get('/', authRequired, requirePermission('admins:read'), async (_req: Request, res: Response) => {
  const admins = await Admin.find().select('-passwordHash -twoFactorSecret').sort({ createdAt: 1 });
  res.json({ items: admins });
});

router.put(
  '/:id/role',
  authRequired,
  requirePermission('admins:write'),
  audit('ADMIN_ROLE_CHANGED', 'admin'),
  validateBody(z.object({ role: z.enum(['ADMIN', 'SUPPORT']) })),
  async (req: Request, res: Response) => {
    if (req.admin!.id === req.params.id) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }
    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true },
    ).select('-passwordHash -twoFactorSecret');
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    res.json({ admin });
  },
);

router.put(
  '/:id/status',
  authRequired,
  requirePermission('admins:write'),
  audit('ADMIN_STATUS_CHANGED', 'admin'),
  validateBody(z.object({ active: z.boolean() })),
  async (req: Request, res: Response) => {
    if (req.admin!.id === req.params.id) {
      res.status(400).json({ error: 'Cannot change your own status' });
      return;
    }
    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { active: req.body.active },
      { new: true },
    ).select('-passwordHash -twoFactorSecret');
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    res.json({ admin });
  },
);

export default router;
