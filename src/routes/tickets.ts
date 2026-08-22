import { Router, Request, Response } from 'express';
import { ticketService } from '../services';
import { Ticket, User } from '../models';
import { authRequired, requirePermission } from '../middleware/auth';
import { validateQuery, validateBody } from '../middleware/validate';
import { paginationSchema } from '../utils/validation';
import { z } from 'zod';
import { audit } from '../middleware/audit';
import { Admin } from '../models';
import { botManager } from '../bot/BotManager';

const router = Router();

router.get(
  '/',
  authRequired,
  requirePermission('tickets:read'),
  validateQuery(paginationSchema),
  async (req: Request, res: Response) => {
    const result = await ticketService.searchTickets({
      search: req.query.search as string,
      status: req.query.status as string,
      priority: req.query.priority as string,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
    });
    res.json(result);
  },
);

router.get('/:ticketId', authRequired, requirePermission('tickets:read'), async (req: Request, res: Response) => {
  const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
    .populate('customerId', 'customerId phoneNumber country name')
    .populate('assignedTo', 'name email');
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({ ticket });
});

const replySchema = z.object({ message: z.string().min(1).max(5000) });

router.post(
  '/:ticketId/reply',
  authRequired,
  requirePermission('tickets:write'),
  audit('TICKET_REPLY', 'ticket'),
  validateBody(replySchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const ticket = await ticketService.addReply(
      req.params.ticketId,
      'ADMIN',
      req.body.message,
      admin._id,
    );
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    await User.findByIdAndUpdate(ticket.customerId, {
      botPaused: true,
      botPausedBy: admin._id,
      botPausedAt: new Date(),
      supportStatus: 'IN_PROGRESS',
    });

    if (botManager.isConnected()) {
      await botManager.sendText(
        ticket.jid,
        `🎫 Ticket: ${ticket.ticketId}\n\n💬 Support Team:\n${req.body.message}\n\nReply here to continue the conversation.`,
      );
    }

    res.json({ ticket });
  },
);

const statusSchema = z.object({ status: z.enum(['OPEN', 'WAITING_FOR_USER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) });

router.post(
  '/:ticketId/status',
  authRequired,
  requirePermission('tickets:resolve'),
  audit('TICKET_STATUS_CHANGED', 'ticket'),
  validateBody(statusSchema),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const ticket = await ticketService.updateStatus(
      req.params.ticketId,
      req.body.status,
      admin._id,
    );
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ ticket });
  },
);

const assignSchema = z.object({ adminId: z.string().regex(/^[0-9a-fA-F]{24}$/) });

router.post(
  '/:ticketId/assign',
  authRequired,
  requirePermission('tickets:write'),
  audit('TICKET_ASSIGNED', 'ticket'),
  validateBody(assignSchema),
  async (req: Request, res: Response) => {
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      { assignedTo: req.body.adminId },
      { new: true },
    );
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ ticket });
  },
);

router.post(
  '/:ticketId/assign-me',
  authRequired,
  requirePermission('tickets:write'),
  audit('TICKET_ASSIGNED_TO_ME', 'ticket'),
  async (req: Request, res: Response) => {
    const admin = await Admin.findById(req.admin!.id);
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      { assignedTo: admin._id, status: 'IN_PROGRESS' },
      { new: true },
    ).populate('assignedTo', 'name email');
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    await User.findByIdAndUpdate(ticket.customerId, {
      botPaused: true,
      botPausedBy: admin._id,
      botPausedAt: new Date(),
      supportStatus: 'IN_PROGRESS',
    });
    await ticket.populate('customerId', 'customerId phoneNumber country name');
    res.json({ ticket });
  },
);

router.delete(
  '/:ticketId',
  authRequired,
  requirePermission('tickets:close'),
  audit('TICKET_DELETED', 'ticket'),
  async (req: Request, res: Response) => {
    const ticket = await Ticket.findOneAndDelete({ ticketId: req.params.ticketId });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ success: true });
  },
);

router.put(
  '/:ticketId/priority',
  authRequired,
  requirePermission('tickets:write'),
  audit('TICKET_PRIORITY_CHANGED', 'ticket'),
  validateBody(z.object({ priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']) })),
  async (req: Request, res: Response) => {
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      { priority: req.body.priority },
      { new: true },
    );
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ ticket });
  },
);

export default router;
