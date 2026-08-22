import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings } from '../services';
import { authRequired, requirePermission } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { z } from 'zod';

const router = Router();

router.get('/', authRequired, requirePermission('settings:read'), async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json({ settings });
});

const settingsSchema = z.object({
  botName: z.string().max(100).optional(),
  supportNumber: z.string().max(30).optional(),
  welcomeMessage: z.string().max(2000).optional(),
  awayMessage: z.string().max(2000).optional(),
  maintenanceMode: z.boolean().optional(),
  supportHours: z
    .object({
      enabled: z.boolean(),
      start: z.string(),
      end: z.string(),
      timezone: z.string(),
    })
    .optional(),
  pricing: z
    .object({
      pakistan: z.object({ amount: z.number().min(0), currency: z.string().min(1).max(10), label: z.string().min(1).max(80) }),
      international: z.object({ amount: z.number().min(0), currency: z.string().min(1).max(10), label: z.string().min(1).max(80) }),
    })
    .optional(),
  paymentInstructions: z.string().max(5000).optional(),
  jazzCash: z.object({
    enabled: z.boolean(),
    accountTitle: z.string().max(100),
    accountNumber: z.string().max(50),
    instructions: z.string().max(1000),
  }).optional(),
  sessionTimeoutMin: z.number().min(1).max(120).optional(),
});

router.put(
  '/',
  authRequired,
  requirePermission('settings:write'),
  audit('SETTINGS_CHANGED', 'settings'),
  async (req: Request, res: Response) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid settings',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    await saveSettings(parsed.data);
    const settings = await loadSettings();
    res.json({ settings });
  },
);

export default router;
