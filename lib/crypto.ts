import crypto from 'node:crypto';

/**
 * Returns the 32-byte Buffer encryption key for AES-256-GCM.
 * Throws loudly if MFA_ENCRYPTION_KEY is missing or not 32 bytes (§5.11 rule 2, §11 M1-T08).
 */
export function getMfaEncryptionKey(): Buffer {
  const rawKey = process.env.MFA_ENCRYPTION_KEY;

  if (!rawKey || !rawKey.trim()) {
    throw new Error(
      'MFA_ENCRYPTION_KEY is missing. It must be set to a 32-byte key (or 64-character hex string).'
    );
  }

  const trimmed = rawKey.trim();

  // If 64 hex characters (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  // If raw 32-byte string
  const buf = Buffer.from(trimmed, 'utf8');
  if (buf.length === 32) {
    return buf;
  }

  throw new Error(
    `MFA_ENCRYPTION_KEY must be exactly 32 bytes (got ${buf.length} bytes / ${trimmed.length} characters).`
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a 12-byte random IV.
 * Format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encrypt(text: string): string {
  const key = getMfaEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM payload formatted as `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
 * Validates the GCM auth tag to ensure integrity.
 */
export function decrypt(payload: string): string {
  const key = getMfaEncryptionKey();
  const parts = payload.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected 3 colon-separated segments');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
