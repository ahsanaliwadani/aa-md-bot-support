import { Request, Response, NextFunction } from 'express';
import { logAction } from '../services/audit';

export function audit(action: string, target: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send.bind(res);
    const admin = req.admin;
    const ip = req.ip || req.socket.remoteAddress;

    res.send = function (body: unknown): Response {
      const result = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
      const targetId =
        (req.params.id as string) ||
        (req.params.keyId as string) ||
        (req.params.ticketId as string) ||
        '';

      if (admin) {
        logAction({
          adminId: admin.id as unknown as import('mongoose').Types.ObjectId,
          adminEmail: admin.email,
          action,
          target,
          targetId,
          detail: typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200),
          ip,
          result,
        }).catch(() => {});
      }

      return originalSend(body as string) as Response;
    } as Response['send'];

    next();
  };
}
