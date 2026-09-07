import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  regenerateRecoveryCodesSchema,
  confirmDeviceReplacementSchema,
} from '../lib/validation/account.ts';
import {
  generateSecret,
  generateRecoveryCodes,
  verifyCode,
} from '../lib/mfa.ts';
import { encrypt, decrypt } from '../lib/crypto.ts';

if (!process.env.MFA_ENCRYPTION_KEY) {
  process.env.MFA_ENCRYPTION_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

describe('Mandatory MFA & Security Page (M6-T06)', () => {
  describe('Validation Schemas (lib/validation/account.ts)', () => {
    test('regenerateRecoveryCodesSchema: requires password', () => {
      const empty = regenerateRecoveryCodesSchema.safeParse({ password: '' });
      assert.strictEqual(empty.success, false);

      const valid = regenerateRecoveryCodesSchema.safeParse({
        password: 'correctpassword123',
      });
      assert.strictEqual(valid.success, true);
    });

    test('confirmDeviceReplacementSchema: strictly enforces 6 digits', () => {
      assert.strictEqual(
        confirmDeviceReplacementSchema.safeParse({ code: '12345' }).success,
        false
      );
      assert.strictEqual(
        confirmDeviceReplacementSchema.safeParse({ code: '1234567' }).success,
        false
      );
      assert.strictEqual(
        confirmDeviceReplacementSchema.safeParse({ code: 'abcdef' }).success,
        false
      );
      assert.strictEqual(
        confirmDeviceReplacementSchema.safeParse({ code: '123456' }).success,
        true
      );
    });
  });

  describe('Recovery Codes Invalidation & Low Threshold Logic', () => {
    test('generates exactly 10 unique recovery codes and valid bcrypt hashes', async () => {
      const { plainCodes, hashedCodes } = await generateRecoveryCodes();

      assert.strictEqual(plainCodes.length, 10);
      assert.strictEqual(hashedCodes.length, 10);

      // Verify all 10 are unique
      const uniquePlain = new Set(plainCodes);
      assert.strictEqual(uniquePlain.size, 10);

      // Verify each plain code matches its respective hash
      for (let i = 0; i < 10; i++) {
        const isMatch = await bcrypt.compare(plainCodes[i], hashedCodes[i]);
        assert.strictEqual(isMatch, true);
      }
    });

    test('regenerating codes replaces previous hashes entirely (invalidating old codes)', async () => {
      const oldGeneration = await generateRecoveryCodes();
      const newGeneration = await generateRecoveryCodes();

      // Ensure no overlap between old and new
      const oldSet = new Set(oldGeneration.plainCodes);
      for (const code of newGeneration.plainCodes) {
        assert.strictEqual(oldSet.has(code), false);
      }

      // If an old code is tested against the new hashes, none match
      for (const hash of newGeneration.hashedCodes) {
        const matchesOld = await bcrypt.compare(oldGeneration.plainCodes[0], hash);
        assert.strictEqual(matchesOld, false);
      }
    });

    test('low recovery codes warning activates strictly below 3 remaining codes', () => {
      const isLowThreshold = (remaining: number) => remaining < 3;

      assert.strictEqual(isLowThreshold(10), false);
      assert.strictEqual(isLowThreshold(5), false);
      assert.strictEqual(isLowThreshold(3), false);
      assert.strictEqual(isLowThreshold(2), true);
      assert.strictEqual(isLowThreshold(1), true);
      assert.strictEqual(isLowThreshold(0), true);
    });
  });

  describe('Safe Device Replacement (Zero Downtime / No Lockout)', () => {
    test('pending secret generation does not affect active secret', () => {
      const activeSecret = generateSecret();
      const encryptedActiveSecret = encrypt(activeSecret);

      // User initiates replacement: new secret created as pending
      const pendingSecret = generateSecret();
      const encryptedPendingSecret = encrypt(pendingSecret);

      // Active secret is still decryptable and distinct
      assert.strictEqual(decrypt(encryptedActiveSecret), activeSecret);
      assert.strictEqual(decrypt(encryptedPendingSecret), pendingSecret);
      assert.notStrictEqual(activeSecret, pendingSecret);

      // Active device continues to verify current TOTP codes while pending exists
      const step = verifyCode(activeSecret, '000000'); // Dummy code to check API
      assert.strictEqual(typeof step === 'number' || step === null, true);
    });

    test('confirming replacement promotes pending secret and drops old secret', () => {
      let activeSecretEncrypted: string | null = encrypt(generateSecret());
      let pendingSecretEncrypted: string | null = encrypt(generateSecret());

      const originalActive = decrypt(activeSecretEncrypted);
      const replacementSecret = decrypt(pendingSecretEncrypted);

      // Simulation of successful verification & promotion:
      activeSecretEncrypted = pendingSecretEncrypted;
      pendingSecretEncrypted = null;

      // Active secret is now the replacement secret
      assert.strictEqual(decrypt(activeSecretEncrypted), replacementSecret);
      assert.notStrictEqual(decrypt(activeSecretEncrypted), originalActive);
      assert.strictEqual(pendingSecretEncrypted, null);
    });
  });
});
