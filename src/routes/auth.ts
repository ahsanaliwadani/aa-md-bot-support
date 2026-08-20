import { Router, Request, Response } from 'express';
import { authService } from '../services';
import { authLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { z } from 'zod';
import { audit } from '../middleware/audit';
import { setAuthCookie, clearAuthCookie, authRequired } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

router.post('/login', authLimiter, validateBody(loginSchema), async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress;
  const result = await authService.login(req.body.email, req.body.password, ip);
  if (!result.success || !result.token) {
    res.status(401).json({ error: result.error || 'Login failed' });
    return;
  }
  setAuthCookie(res, result.token);
  res.json({ token: result.token, admin: result.admin });
});

router.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get('/me', authRequired, (req: Request, res: Response) => {
  res.json({ admin: req.admin });
});

router.post(
  '/change-password',
  authRequired,
  audit('ADMIN_PASSWORD_CHANGED', 'admin'),
  validateBody(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  ),
  async (req: Request, res: Response) => {
    const { Admin } = await import('../models');
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const ok = await authService.verifyPassword(req.body.currentPassword, admin.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'Current password incorrect' });
      return;
    }
    admin.passwordHash = await authService.hashPassword(req.body.newPassword);
    await admin.save();
    res.json({ success: true });
  },
);

export default router;
