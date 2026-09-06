import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as OTPAuth from 'otpauth';
import {
  generateSecret,
  buildOtpauthUri,
  verifyCode,
  generateRecoveryCodes,
  consumeRecoveryCode,
} from '../lib/mfa.ts';
import { encrypt, decrypt, getMfaEncryptionKey } from '../lib/crypto.ts';

describe('MFA & TOTP Core (M1-T08)', () => {
  describe('AES-256-GCM Encryption (lib/crypto.ts)', () => {
    test('encrypt -> decrypt roundtrip succeeds with correct plaintext', () => {
      const originalSecret = generateSecret();
      const encrypted = encrypt(originalSecret);

      assert.notStrictEqual(encrypted, originalSecret);
      assert.strictEqual(encrypted.split(':').length, 3); // iv:authTag:ciphertext

      const decrypted = decrypt(encrypted);
      assert.strictEqual(decrypted, originalSecret);
    });

    test('throws loudly if MFA_ENCRYPTION_KEY is missing or invalid length', () => {
      const savedKey = process.env.MFA_ENCRYPTION_KEY;
      try {
        delete process.env.MFA_ENCRYPTION_KEY;
        assert.throws(() => getMfaEncryptionKey(), /MFA_ENCRYPTION_KEY is missing/);

        process.env.MFA_ENCRYPTION_KEY = 'too-short';
        assert.throws(() => getMfaEncryptionKey(), /must be exactly 32 bytes/);
      } finally {
        process.env.MFA_ENCRYPTION_KEY = savedKey;
      }
    });
  });

  describe('TOTP Core Logic (lib/mfa.ts)', () => {
    test('generates 20-byte base32 secret and valid Google Authenticator URI', () => {
      const secret = generateSecret();
      assert.ok(secret);
      // 20 bytes in base32 is 32 characters
      assert.strictEqual(secret.length, 32);

      const uri = buildOtpauthUri('user@example.com', secret);
      assert.ok(uri.startsWith('otpauth://totp/Bilyo:user%40example.com?'));
      assert.ok(uri.includes('algorithm=SHA1'));
      assert.ok(uri.includes('digits=6'));
      assert.ok(uri.includes('period=30'));
      assert.ok(uri.includes(`secret=${secret}`));
    });

    test('accepts valid code within current period (delta 0)', () => {
      const secret = generateSecret();
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const now = Date.now();
      const code = totp.generate({ timestamp: now });
      const currentStep = Math.floor(now / 1000 / 30);

      const step = verifyCode(secret, code, null, now);
      assert.strictEqual(step, currentStep);
    });

    test('accepts code one step early (-30s) and one step late (+30s)', () => {
      const secret = generateSecret();
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const now = Date.now();
      const currentStep = Math.floor(now / 1000 / 30);

      // One step early (-30s)
      const earlyCode = totp.generate({ timestamp: now - 30000 });
      const earlyStep = verifyCode(secret, earlyCode, null, now);
      assert.strictEqual(earlyStep, currentStep - 1);

      // One step late (+30s)
      const lateCode = totp.generate({ timestamp: now + 30000 });
      const lateStep = verifyCode(secret, lateCode, null, now);
      assert.strictEqual(lateStep, currentStep + 1);
    });

    test('rejects code two steps early (-60s) or two steps late (+60s)', () => {
      const secret = generateSecret();
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const now = Date.now();

      // Two steps early (-60s)
      const tooEarlyCode = totp.generate({ timestamp: now - 60000 });
      assert.strictEqual(verifyCode(secret, tooEarlyCode, null, now), null);

      // Two steps late (+60s)
      const tooLateCode = totp.generate({ timestamp: now + 60000 });
      assert.strictEqual(verifyCode(secret, tooLateCode, null, now), null);
    });

    test('replay protection: rejects code at or below mfaLastUsedStep', () => {
      const secret = generateSecret();
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const now = Date.now();
      const currentStep = Math.floor(now / 1000 / 30);
      const code = totp.generate({ timestamp: now });

      // First verification passes
      const step = verifyCode(secret, code, null, now);
      assert.strictEqual(step, currentStep);

      // Replay with lastStep equal to currentStep is rejected
      const replayed = verifyCode(secret, code, currentStep, now);
      assert.strictEqual(replayed, null);

      // Replay with lastStep higher than currentStep is rejected
      const pastReplayed = verifyCode(secret, code, currentStep + 1, now);
      assert.strictEqual(pastReplayed, null);
    });

    test('rejects malformed, empty, or non-numeric codes', () => {
      const secret = generateSecret();
      assert.strictEqual(verifyCode(secret, '12345'), null);
      assert.strictEqual(verifyCode(secret, '1234567'), null);
      assert.strictEqual(verifyCode(secret, 'abcdef'), null);
      assert.strictEqual(verifyCode(secret, ''), null);
      assert.strictEqual(verifyCode(secret, '      '), null);
    });
  });

  describe('Recovery Codes', () => {
    test('generates 10 bcrypt-hashed recovery codes', async () => {
      const { plainCodes, hashedCodes } = await generateRecoveryCodes();
      assert.strictEqual(plainCodes.length, 10);
      assert.strictEqual(hashedCodes.length, 10);

      for (const code of plainCodes) {
        assert.match(code, /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
      }
      for (const hash of hashedCodes) {
        assert.ok(hash.startsWith('$2'));
      }
    });

    test('consumeRecoveryCode validates and consumes a valid recovery code', async () => {
      const { plainCodes, hashedCodes } = await generateRecoveryCodes();
      const codeToUse = plainCodes[3];

      const res = await consumeRecoveryCode(codeToUse, hashedCodes);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.remainingHashedCodes.length, 9);

      // Consuming the same code again fails
      const reuseRes = await consumeRecoveryCode(codeToUse, res.remainingHashedCodes);
      assert.strictEqual(reuseRes.valid, false);
      assert.strictEqual(reuseRes.remainingHashedCodes.length, 9);
    });

    test('consumeRecoveryCode rejects invalid code', async () => {
      const { hashedCodes } = await generateRecoveryCodes();
      const res = await consumeRecoveryCode('invalid-code-1234', hashedCodes);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.remainingHashedCodes.length, 10);
    });
  });

  describe('Security Audit: Zero Secrets Logged', () => {
    test('no log statements in lib/ print or reveal secrets', () => {
      const libDir = path.join(process.cwd(), 'lib');
      const files = fs.readdirSync(libDir, { recursive: true }) as string[];

      for (const file of files) {
        if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
        const content = fs.readFileSync(path.join(libDir, file), 'utf8');

        // Verify console.log / console.error does not log secrets or codes
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('console.') && /secret|code|password/i.test(line)) {
            // Only allow generic tags like [PASSWORD_RESET] or error message without printing the secret variable
            assert.strictEqual(
              /console\.(log|error|warn)\([^)]*\b(secret|code|rawToken|token)\b[^)]*\)/.test(
                line
              ),
              false,
              `Potential credential logging in ${file}: ${line}`
            );
          }
        }
      }
    });
  });
});
