import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildUsersFilter } from '../lib/admin/users.ts';

describe('Admin User List Query & Pagination (M7-T02)', () => {
  describe('buildUsersFilter query builder', () => {
    test('empty params return empty filter (matches all)', () => {
      const filter = buildUsersFilter({});
      assert.deepStrictEqual(filter, {});
    });

    test('searching empty string returns empty filter (does not filter)', () => {
      const filter = buildUsersFilter({ search: '   ' });
      assert.deepStrictEqual(filter, {});
    });

    test('plan filter adds exact plan match', () => {
      const filter = buildUsersFilter({ plan: 'BUSINESS' });
      assert.deepStrictEqual(filter, { plan: 'BUSINESS' });
    });

    test('plan "ALL" does not filter by plan', () => {
      const filter = buildUsersFilter({ plan: 'ALL' });
      assert.deepStrictEqual(filter, {});
    });

    test('status "SUSPENDED" filters for non-null suspendedAt', () => {
      const filter = buildUsersFilter({ status: 'SUSPENDED' });
      assert.deepStrictEqual(filter, { suspendedAt: { $ne: null } });
    });

    test('status "ACTIVE" filters for null suspendedAt and deletionRequestedAt', () => {
      const filter = buildUsersFilter({ status: 'ACTIVE' });
      assert.deepStrictEqual(filter, { suspendedAt: null, deletionRequestedAt: null });
    });

    test('status "DELETION" filters for non-null deletionRequestedAt', () => {
      const filter = buildUsersFilter({ status: 'DELETION' });
      assert.deepStrictEqual(filter, { deletionRequestedAt: { $ne: null } });
    });

    test('activeIn30Days adds 30-day date boundary for activity or login', () => {
      const filter = buildUsersFilter({ activeIn30Days: true }) as {
        $or: Array<{ lastActiveAt?: { $gte: Date }; lastLoginAt?: { $gte: Date } }>;
      };
      assert.ok(filter.$or);
      assert.strictEqual(filter.$or.length, 2);
      assert.ok(filter.$or[0].lastActiveAt?.$gte instanceof Date);
      assert.ok(filter.$or[1].lastLoginAt?.$gte instanceof Date);
    });

    test('search query includes email, name, and matching business IDs', () => {
      const businessId = '507f1f77bcf86cd799439011';
      const filter = buildUsersFilter({
        search: 'acme',
        matchingBusinessUserIds: [businessId],
      }) as {
        $or: Array<Record<string, unknown>>;
      };

      assert.ok(filter.$or);
      assert.strictEqual(filter.$or.length, 3);
      assert.deepStrictEqual(filter.$or[0], {
        email: { $regex: 'acme', $options: 'i' },
      });
      assert.deepStrictEqual(filter.$or[1], {
        name: { $regex: 'acme', $options: 'i' },
      });
      assert.deepStrictEqual(filter.$or[2], {
        _id: { $in: [businessId] },
      });
    });

    test('multiple filters are composed with $and', () => {
      const filter = buildUsersFilter({
        plan: 'FREELANCER',
        status: 'ACTIVE',
        search: 'santos',
      }) as {
        $and: unknown[];
      };

      assert.ok(filter.$and);
      assert.strictEqual(filter.$and.length, 3);
    });
  });

  describe('Pagination calculations', () => {
    test('calculates correct skip and totalPages at 25/page', () => {
      const limit = 25;

      const calc = (total: number, page: number) => ({
        skip: (page - 1) * limit,
        totalPages: Math.ceil(total / limit) || 1,
      });

      assert.deepStrictEqual(calc(0, 1), { skip: 0, totalPages: 1 });
      assert.deepStrictEqual(calc(25, 1), { skip: 0, totalPages: 1 });
      assert.deepStrictEqual(calc(26, 1), { skip: 0, totalPages: 2 });
      assert.deepStrictEqual(calc(26, 2), { skip: 25, totalPages: 2 });
      assert.deepStrictEqual(calc(10000, 400), { skip: 9975, totalPages: 400 });
    });
  });
});
