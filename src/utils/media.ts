import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const MESSAGE_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'messages');

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface StoredMedia {
  url: string;
  path: string;
  mimetype: string;
}

export function isAllowedImageMime(mimetype?: string): boolean {
  return Boolean(mimetype && IMAGE_EXTENSIONS[mimetype]);
}

export async function saveMessageImage(buffer: Buffer, mimetype = 'image/jpeg'): Promise<StoredMedia> {
  if (!isAllowedImageMime(mimetype)) throw new Error('Unsupported image type');
  await fs.mkdir(MESSAGE_UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${IMAGE_EXTENSIONS[mimetype]}`;
  const filePath = path.join(MESSAGE_UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return { url: `/uploads/messages/${filename}`, path: filePath, mimetype };
}

export function parseImageDataUrl(dataUrl: string): { buffer: Buffer; mimetype: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Invalid image data');
  return { mimetype: match[1], buffer: Buffer.from(match[2], 'base64') };
}
