import { put, del } from '@vercel/blob';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export type AllowedMimeType = 'image/png' | 'image/jpeg' | 'image/webp';
export type AllowedExtension = 'png' | 'jpg' | 'webp';

export interface ImageValidationResult {
  ok: boolean;
  error?: string;
  mimeType?: AllowedMimeType;
  extension?: AllowedExtension;
}

/**
 * Validates an image buffer server-side against:
 * 1. File size cap (2MB)
 * 2. True magic bytes (PNG, JPEG, WebP)
 * 3. Content-type match (if declared)
 *
 * Explicitly rejects renamed executables (e.g. .exe files starting with MZ / 0x4D 0x5A),
 * scripts, and non-image payloads (M6-T01).
 */
export function validateImageBuffer(
  buffer: Buffer | Uint8Array,
  declaredMimeType?: string,
  declaredSize?: number
): ImageValidationResult {
  const size = declaredSize ?? buffer.length;

  if (size > MAX_LOGO_SIZE_BYTES) {
    return {
      ok: false,
      error: `File size exceeds the 2MB limit (received ${(size / (1024 * 1024)).toFixed(2)}MB).`,
    };
  }

  if (buffer.length < 12) {
    return {
      ok: false,
      error: 'File is too small or corrupted to be a valid image.',
    };
  }

  // Check for Windows DOS/PE executable header ("MZ" = 0x4D 0x5A)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return {
      ok: false,
      error: 'Executable files (.exe) are strictly prohibited.',
    };
  }

  // Check for ELF executable header (0x7F 'E' 'L' 'F')
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return {
      ok: false,
      error: 'Executable binaries are strictly prohibited.',
    };
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (isPng) {
    if (declaredMimeType && declaredMimeType !== 'image/png') {
      return {
        ok: false,
        error: `Content type mismatch: declared '${declaredMimeType}' but file is image/png.`,
      };
    }
    return { ok: true, mimeType: 'image/png', extension: 'png' };
  }

  // 2. JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  if (isJpeg) {
    if (
      declaredMimeType &&
      declaredMimeType !== 'image/jpeg' &&
      declaredMimeType !== 'image/jpg'
    ) {
      return {
        ok: false,
        error: `Content type mismatch: declared '${declaredMimeType}' but file is image/jpeg.`,
      };
    }
    return { ok: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 3. WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (isWebp) {
    if (declaredMimeType && declaredMimeType !== 'image/webp') {
      return {
        ok: false,
        error: `Content type mismatch: declared '${declaredMimeType}' but file is image/webp.`,
      };
    }
    return { ok: true, mimeType: 'image/webp', extension: 'webp' };
  }

  return {
    ok: false,
    error: 'Invalid file format. Only genuine PNG, JPEG, and WebP images are allowed.',
  };
}

/**
 * Uploads a validated business logo buffer.
 * Uses Vercel Blob if BLOB_READ_WRITE_TOKEN is configured;
 * falls back to local static storage (public/uploads/logos/) for local development.
 */
export async function uploadBusinessLogo(
  userId: string,
  buffer: Buffer,
  _filename: string,
  mimeType: AllowedMimeType,
  extension: AllowedExtension
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const fileName = `${crypto.randomUUID()}.${extension}`;

  if (token && token.trim().length > 0) {
    // Vercel Blob store in production / preview with token configured
    const blob = await put(`logos/${fileName}`, buffer, {
      access: 'public',
      contentType: mimeType,
      token,
    });
    return blob.url;
  }

  // Local development fallback: store in public/uploads/logos/
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
  await fs.mkdir(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, buffer);

  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';
  return `${baseUrl}/uploads/logos/${fileName}`;
}

/**
 * Deletes a previously stored business logo from Vercel Blob or local storage.
 */
export async function deleteBusinessLogo(logoUrl: string): Promise<void> {
  if (!logoUrl) return;

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token && logoUrl.includes('public.blob.vercel-storage.com')) {
    try {
      await del(logoUrl, { token });
      return;
    } catch (err) {
      console.error('Failed to delete blob from Vercel Blob store:', (err as Error).message);
    }
  }

  // Local file fallback cleanup
  try {
    const url = new URL(logoUrl);
    if (url.pathname.startsWith('/uploads/logos/')) {
      const localPath = path.join(process.cwd(), 'public', url.pathname);
      await fs.unlink(localPath);
    }
  } catch {
    // Ignore if not local or unparseable
  }
}
