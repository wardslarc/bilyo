import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { strongPasswordSchema, isCommonPassword } from '../lib/validation/password.ts';
import { registerSchema, resetPasswordSchema } from '../lib/validation/auth.ts';
import { changePasswordSchema } from '../lib/validation/account.ts';

describe('Password Policy & Weak Password Blocklist', () => {
  test('detects common passwords', () => {
    assert.equal(isCommonPassword('password'), true);
    assert.equal(isCommonPassword('12345678'), true);
    assert.equal(isCommonPassword('password123'), true);
    assert.equal(isCommonPassword('admin123'), true);
    assert.equal(isCommonPassword('bilyo123'), true);
    assert.equal(isCommonPassword('UniqueSecureP@ss2026'), false);
  });

  test('strongPasswordSchema rejects short passwords', () => {
    const res = strongPasswordSchema.safeParse('short');
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error.issues[0]?.message || '', /at least 8 characters/);
    }
  });

  test('strongPasswordSchema rejects common passwords', () => {
    const res = strongPasswordSchema.safeParse('password');
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.error.issues[0]?.message || '', /too common/);
    }
  });

  test('strongPasswordSchema accepts strong passwords', () => {
    const res = strongPasswordSchema.safeParse('MySecretP@ssword2026!');
    assert.equal(res.success, true);
  });

  test('registerSchema and changePasswordSchema reject common passwords', () => {
    const regRes = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    });
    assert.equal(regRes.success, false);

    const resetRes = resetPasswordSchema.safeParse({
      token: 'some-token',
      password: 'password123',
    });
    assert.equal(resetRes.success, false);

    const changeRes = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword123!',
      newPassword: 'password123',
      confirmNewPassword: 'password123',
    });
    assert.equal(changeRes.success, false);
  });
});
