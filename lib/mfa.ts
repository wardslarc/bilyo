import crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';
import bcrypt from 'bcryptjs';

export const MFA_PARAMETERS = {
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  issuer: 'Bilyo',
} as const;

/**
 * Generates 20 cryptographically secure random bytes and returns the base32 secret.
 * RFC 6238 / Google Authenticator standard (§5.11 rule 2).
 */
export function generateSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Builds the standard otpauth URI pinned to SHA-1, 6 digits, 30 seconds (§5.11 rule 1).
 */
export function buildOtpauthUri(email: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: MFA_PARAMETERS.issuer,
    label: email.trim().toLowerCase(),
    algorithm: MFA_PARAMETERS.algorithm,
    digits: MFA_PARAMETERS.digits,
    period: MFA_PARAMETERS.period,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.toString();
}

/**
 * Verifies a 6-digit TOTP code against a secret within a ±1 step (±30s) window.
 * Enforces the replay guard (§5.11 rule 5): step must be strictly > lastStep.
 * Returns the accepted step counter (integer) on success, or null on rejection.
 */
export function verifyCode(
  secret: string,
  code: string,
  lastStep?: number | null,
  timestamp: number = Date.now()
): number | null {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const cleanCode = code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return null;
  }

  try {
    const totp = new OTPAuth.TOTP({
      issuer: MFA_PARAMETERS.issuer,
      label: MFA_PARAMETERS.issuer,
      algorithm: MFA_PARAMETERS.algorithm,
      digits: MFA_PARAMETERS.digits,
      period: MFA_PARAMETERS.period,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({
      token: cleanCode,
      window: 1, // ±1 step window (§5.11 rule 4)
      timestamp,
    });

    if (delta === null) {
      return null;
    }

    const currentStep = Math.floor(timestamp / 1000 / MFA_PARAMETERS.period);
    const acceptedStep = currentStep + delta;

    // Replay guard: one code, one use (§5.11 rule 5)
    if (lastStep != null && acceptedStep <= lastStep) {
      return null;
    }

    return acceptedStep;
  } catch {
    return null;
  }
}

/**
 * Generates 10 single-use recovery codes, formatted as `xxxx-xxxx-xxxx`.
 * Returns plaintext codes (to display once) and bcrypt-hashed codes (to store at rest).
 */
export async function generateRecoveryCodes(): Promise<{
  plainCodes: string[];
  hashedCodes: string[];
}> {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const raw = crypto.randomBytes(6).toString('hex');
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    plainCodes.push(code);

    const hash = await bcrypt.hash(code, 10);
    hashedCodes.push(hash);
  }

  return { plainCodes, hashedCodes };
}

/**
 * Consumes a recovery code by checking it against stored bcrypt hashes.
 * If valid, removes the consumed code from the list and returns the remaining hashes.
 */
export async function consumeRecoveryCode(
  plainCode: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remainingHashedCodes: string[] }> {
  if (!plainCode || typeof plainCode !== 'string' || !hashedCodes?.length) {
    return { valid: false, remainingHashedCodes: hashedCodes || [] };
  }

  const normalized = plainCode.trim().toLowerCase();

  for (let i = 0; i < hashedCodes.length; i++) {
    const isMatch = await bcrypt.compare(normalized, hashedCodes[i]);
    if (isMatch) {
      const remainingHashedCodes = hashedCodes.filter((_, index) => index !== i);
      return { valid: true, remainingHashedCodes };
    }
  }

  return { valid: false, remainingHashedCodes: hashedCodes };
}
