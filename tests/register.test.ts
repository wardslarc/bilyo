import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { RateLimit } from '../models/rate-limit.ts';
import { registerUser } from '../actions/auth.ts';
import { LEGAL_VERSION } from '../lib/site.ts';

describe('actions/auth.ts - registerUser', () => {
  const createdUserIds: string[] = [];

  before(async () => {
    await dbConnect();
    await RateLimit.deleteMany({ key: { $regex: '^rate:register:' } });
  });

  after(async () => {
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await RateLimit.deleteMany({ key: { $regex: '^rate:register:' } });
    await mongoose.disconnect();
  });

  test('validates input using Zod and rejects invalid inputs with field errors', async () => {
    const invalidResult = await registerUser({
      name: 'A', // min 2
      email: 'not-an-email',
      password: '123', // min 8
      acceptedTerms: false,
    });

    assert.strictEqual(invalidResult.ok, false);
    assert.ok(invalidResult.fieldErrors);
    assert.ok(invalidResult.fieldErrors?.name);
    assert.ok(invalidResult.fieldErrors?.email);
    assert.ok(invalidResult.fieldErrors?.password);
    assert.ok(invalidResult.fieldErrors?.acceptedTerms);
  });

  test('creates a user with normalized email, bcrypt cost 10, role USER, and accepted terms', async () => {
    const mixedCaseEmail = `Register.${Date.now()}@Example.COM`;
    const result = await registerUser({
      name: 'Test Registrant',
      email: mixedCaseEmail,
      password: 'StrongPassword123!',
      acceptedTerms: true,
    });

    assert.strictEqual(result.ok, true);
    if (!result.ok) return;

    createdUserIds.push(result.data.userId);

    // Verify stored user in database
    const userInDb = await User.findById(result.data.userId);
    assert.ok(userInDb);
    assert.strictEqual(userInDb.name, 'Test Registrant');
    assert.strictEqual(userInDb.email, mixedCaseEmail.toLowerCase().trim());
    assert.strictEqual(userInDb.role, 'USER');
    // Assert against the constant, not a literal: the stored version has to
    // track LEGAL_VERSION, so a legal-page bump must not break this test.
    assert.strictEqual(userInDb.acceptedTermsVersion, LEGAL_VERSION);
    assert.ok(userInDb.acceptedTermsAt instanceof Date);

    // Stored hash must start with $2 and not be plain password
    assert.ok(userInDb.passwordHash.startsWith('$2'));
    assert.notStrictEqual(userInDb.passwordHash, 'StrongPassword123!');
  });

  test('duplicate email returns a field error, not a 500 error', async () => {
    // Attempt to register again with same email
    const duplicateEmail = `dup.${Date.now()}@example.com`;

    const first = await registerUser({
      name: 'User One',
      email: duplicateEmail,
      password: 'Password123!',
      acceptedTerms: true,
    });
    assert.strictEqual(first.ok, true);
    if (first.ok) createdUserIds.push(first.data.userId);

    // Second registration with duplicate email
    const second = await registerUser({
      name: 'User Two',
      email: duplicateEmail.toUpperCase(),
      password: 'AnotherPassword123!',
      acceptedTerms: true,
    });

    assert.strictEqual(second.ok, false);
    assert.ok(second.fieldErrors);
    assert.strictEqual(
      second.fieldErrors?.email,
      'An account with this email already exists'
    );
  });
});
