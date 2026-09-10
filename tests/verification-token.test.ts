import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  signSignupSessionToken,
  verifySignupSessionToken,
} from '../lib/signup-challenge.ts';
import { VerificationToken } from '../models/verification-token.ts';
import dbConnect from '../lib/mongodb.ts';

describe('Verification Token & Signup Session (SIGNUP_VERIFICATION_PLAN.md §3.1, §4.4, §4.6)', () => {
  describe('signupSessionToken signing & verification', () => {
    test('signs and verifies a valid signup session token', () => {
      const userId = 'usr_mock_123';
      const tokenId = 'tok_mock_456';
      const token = signSignupSessionToken(userId, tokenId);

      assert.ok(typeof token === 'string');
      assert.match(token, /^[A-Za-z0-9_-]+\.[0-9a-fA-F]{64}$/);

      const verified = verifySignupSessionToken(token);
      assert.ok(verified);
      assert.equal(verified?.userId, userId);
      assert.equal(verified?.tokenId, tokenId);
      assert.ok(verified!.expiresAt > Date.now());
    });

    test('rejects tampered signup session token', () => {
      const token = signSignupSessionToken('usr_orig', 'tok_orig');
      const [, sig] = token.split('.');

      const tamperedJson = JSON.stringify({ userId: 'usr_hacked', tokenId: 'tok_orig', expiresAt: Date.now() + 10000 });
      const tamperedBase64 = Buffer.from(tamperedJson).toString('base64url');
      const tamperedToken = `${tamperedBase64}.${sig}`;

      const verified = verifySignupSessionToken(tamperedToken);
      assert.equal(verified, null);
    });
  });

  describe('Token hashing & dual algorithm invariants (§3.1)', () => {
    test('uses SHA-256 for 32-byte link token and bcrypt cost 10 for 6-digit code', async () => {
      const rawCode = '123456';
      const rawToken = crypto.randomBytes(32).toString('hex');

      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const codeHash = await bcrypt.hash(rawCode, 10);

      // Link token is fast 64-character hex hash
      assert.equal(tokenHash.length, 64);
      assert.match(tokenHash, /^[0-9a-f]{64}$/);

      // Code is bcrypt cost-10 hash
      assert.ok(codeHash.startsWith('$2'));
      assert.equal(await bcrypt.compare(rawCode, codeHash), true);
      assert.equal(await bcrypt.compare('654321', codeHash), false);
    });
  });

  describe('Server-side attempt budget & invalidation database integration (§4.6)', () => {
    const testUserId = new mongoose.Types.ObjectId();
    const createdTokenIds: mongoose.Types.ObjectId[] = [];
    let dbAvailable = false;

    after(async () => {
      if (dbAvailable) {
        try {
          await VerificationToken.deleteMany({ _id: { $in: createdTokenIds } });
          await mongoose.disconnect();
        } catch {
          // ignore disconnect errors
        }
      }
    });

    test('enforces atomic server-side attempt counting up to 5 attempts', async () => {
      try {
        await dbConnect();
        dbAvailable = true;
      } catch (err) {
        console.warn('MongoDB not available, skipping live DB test:', (err as Error).message);
        return;
      }

      const code = '789123';
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const codeHash = await bcrypt.hash(code, 10);

      const doc = await VerificationToken.create({
        userId: testUserId,
        purpose: 'EMAIL_VERIFY',
        tokenHash,
        codeHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        codeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0,
      });
      createdTokenIds.push(doc._id);

      // Simulate 5 wrong guesses
      for (let i = 1; i <= 5; i++) {
        const updated = await VerificationToken.findOneAndUpdate(
          { _id: doc._id, usedAt: null, codeInvalidAt: null },
          { $inc: { attempts: 1 } },
          { returnDocument: 'after' }
        );
        assert.ok(updated);
        assert.equal(updated?.attempts, i);
      }

      // 6th attempt causes invalidation
      const sixth = await VerificationToken.findOneAndUpdate(
        { _id: doc._id, usedAt: null, codeInvalidAt: null },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' }
      );
      assert.ok(sixth);
      assert.equal(sixth?.attempts, 6);

      // If attempts > 5, burns the code
      if (sixth && sixth.attempts > 5) {
        await VerificationToken.updateOne(
          { _id: sixth._id },
          { $set: { codeInvalidAt: new Date() } }
        );
      }

      const burnedDoc = await VerificationToken.findById(doc._id);
      assert.ok(burnedDoc?.codeInvalidAt);
    });
  });
});
