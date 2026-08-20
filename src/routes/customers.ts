import { Router, Request, Response } from 'express';
import { userService } from '../services';
import { User, Ticket, Payment, Message } from '../models';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';
import { z } from 'zod';
import { audit } from '../middleware/audit';

const router = Router();

router.get(
  '/',
  authRequired,
  requirePermission('customers:read'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    const result = await userService.searchUsers({
      search: req.query.search as string,
      status: req.query.status as string,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  },
);

router.get('/:id', authRequired, requirePermission('customers:read'), async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  const [tickets, payments] = await Promise.all([
    Ticket.find({ customerId: user._id }).sort({ createdAt: -1 }).limit(20),
    Payment.find({ customerId: user._id }).sort({ createdAt: -1 }).limit(20),
  ]);
  res.json({ user, tickets, payments });
});

router.get('/:id/conversation', authRequired, requirePermission('messages:read'), async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  const messages = await Message.find({ jid: user.jid }).sort({ at: 1 }).limit(200);
  res.json({ items: messages });
});

router.put(
  '/:id/notes',
  authRequired,
  requirePermission('customers:write'),
  audit('CUSTOMER_NOTES_UPDATED', 'customer'),
  validateBody(z.object({ notes: z.string().max(2000) })),
  async (req: Request, res: Response) => {
    const user = await userService.updateNotes(req.params.id, req.body.notes);
    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ user });
  },
);

router.post(
  '/:id/tags',
  authRequired,
  requirePermission('customers:write'),
  audit('CUSTOMER_TAG_ADDED', 'customer'),
  validateBody(z.object({ tag: z.string().min(1).max(50) })),
  async (req: Request, res: Response) => {
    const user = await userService.addTag(req.params.id, req.body.tag);
    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ user });
  },
);

router.delete(
  '/:id/tags/:tag',
  authRequired,
  requirePermission('customers:write'),
  audit('CUSTOMER_TAG_REMOVED', 'customer'),
  async (req: Request, res: Response) => {
    const user = await userService.removeTag(req.params.id, req.params.tag);
    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ user });
  },
);

router.post(
  '/:id/block',
  authRequired,
  requirePermission('customers:write'),
  audit('CUSTOMER_BLOCKED', 'customer'),
  validateBody(z.object({ reason: z.string().min(1).max(500) })),
  async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const updated = await userService.blockUser(user.jid, req.body.reason);
    res.json({ user: updated });
  },
);

router.post(
  '/:id/unblock',
  authRequired,
  requirePermission('customers:write'),
  audit('CUSTOMER_UNBLOCKED', 'customer'),
  async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const updated = await userService.unblockUser(user.jid);
    res.json({ user: updated });
  },
);

export default router;
