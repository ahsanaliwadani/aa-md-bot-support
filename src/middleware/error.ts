import { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Don't leak internal errors in production
  const message = err.message || 'Internal server error';
  res.status(500).json({ error: message });
}
