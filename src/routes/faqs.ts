import { Router, Request, Response } from 'express';
import { faqService } from '../services';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { z } from 'zod';
import { audit } from '../middleware/audit';

const router = Router();

router.get('/', authRequired, requirePermission('faq:read'), async (_req: Request, res: Response) => {
  await faqService.seedDefaultFAQs();
  const faqs = await faqService.listFAQs();
  res.json({ items: faqs });
});

router.post(
  '/',
  authRequired,
  requirePermission('faq:write'),
  audit('FAQ_CREATED', 'faq'),
  validateBody(
    z.object({
      question: z.string().min(1).max(500),
      answer: z.string().min(1).max(5000),
      keywords: z.array(z.string().max(50)).optional(),
    }),
  ),
  async (req: Request, res: Response) => {
    const faq = await faqService.createFAQ(req.body);
    res.json({ faq });
  },
);

router.put(
  '/:id',
  authRequired,
  requirePermission('faq:write'),
  audit('FAQ_UPDATED', 'faq'),
  validateBody(
    z.object({
      question: z.string().min(1).max(500).optional(),
      answer: z.string().min(1).max(5000).optional(),
      keywords: z.array(z.string().max(50)).optional(),
      enabled: z.boolean().optional(),
    }),
  ),
  async (req: Request, res: Response) => {
    const faq = await faqService.updateFAQ(req.params.id, req.body);
    if (!faq) {
      res.status(404).json({ error: 'FAQ not found' });
      return;
    }
    res.json({ faq });
  },
);

router.delete(
  '/:id',
  authRequired,
  requirePermission('faq:write'),
  audit('FAQ_DELETED', 'faq'),
  async (req: Request, res: Response) => {
    const ok = await faqService.deleteFAQ(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'FAQ not found' });
      return;
    }
    res.json({ success: true });
  },
);

export default router;
