import { Request, Response, NextFunction } from 'express';

export function sanitizeInput(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeInput);

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    if (typeof value === 'string') {
      clean[key] = value.replace(/<[^>]*>/g, '').trim();
    } else if (typeof value === 'object') {
      clean[key] = sanitizeInput(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) req.body = sanitizeInput(req.body);
  next();
}
