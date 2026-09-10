import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/user.ts';

// Set global.mongoose BEFORE importing auth-guards
global.mongoose = {
  conn: { connection: { readyState: 1 } } as unknown as typeof import('mongoose'),
  promise: Promise.resolve({ connection: { readyState: 1 } } as unknown as typeof import('mongoose')),
};

const { assertNotSuspended, AuthGuardError } = await import('../lib/auth-guards.ts');

describe('Session Invalidation on Password / Credential Reset', () => {
  test('assertNotSuspended rejects stale session issued before sessionsValidFrom', async () => {
    const origFindById = User.findById;
    try {
      const revokedTime = new Date(1700000000 * 1000); // T2
      User.findById = (() => ({
        select: async () => ({
          _id: 'usr_test',
          suspendedAt: null,
          deletionRequestedAt: null,
          sessionsValidFrom: revokedTime,
        }),
      })) as unknown as typeof User.findById;

      // Session issued at T1 < T2
      const staleAuthTime = 1699999000;
      await assert.rejects(
        async () => {
          await assertNotSuspended('usr_test', staleAuthTime);
        },
        (err: Error) => {
          assert.ok(err instanceof AuthGuardError);
          assert.equal(err.code, 'UNAUTHORIZED');
          assert.match(err.message, /revoked/);
          return true;
        }
      );
    } finally {
      User.findById = origFindById;
    }
  });

  test('assertNotSuspended allows fresh session issued after sessionsValidFrom', async () => {
    const origFindById = User.findById;
    try {
      const revokedTime = new Date(1700000000 * 1000); // T2
      User.findById = (() => ({
        select: async () => ({
          _id: 'usr_test',
          suspendedAt: null,
          deletionRequestedAt: null,
          sessionsValidFrom: revokedTime,
        }),
      })) as unknown as typeof User.findById;

      // Session issued at T3 > T2
      const freshAuthTime = 1700000500;
      const user = await assertNotSuspended('usr_test', freshAuthTime);
      assert.ok(user);
    } finally {
      User.findById = origFindById;
    }
  });
});
