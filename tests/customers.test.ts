import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { Customer } from '../models/customer.ts';
import { Quotation } from '../models/quotation.ts';
import { customerSchema } from '../lib/validation/customer.ts';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  archiveCustomer,
} from '../actions/customers.ts';
import { setAuthGetter } from '../lib/auth-guards.ts';

describe('Customers CRUD (M2-T03)', () => {
  const userAEmail = `cust-a-${Date.now()}@example.com`;
  const userBEmail = `cust-b-${Date.now()}@example.com`;
  let userAId: string;
  let userBId: string;

  before(async () => {
    await dbConnect();
    const hash = await bcrypt.hash('Password123!', 10);

    const userA = await User.create({
      email: userAEmail,
      passwordHash: hash,
      name: 'User A',
      role: 'USER',
    });
    userAId = userA._id.toString();

    const userB = await User.create({
      email: userBEmail,
      passwordHash: hash,
      name: 'User B',
      role: 'USER',
    });
    userBId = userB._id.toString();
  });

  after(async () => {
    await Customer.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Quotation.deleteMany({ userId: { $in: [userAId, userBId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await mongoose.disconnect();
  });

  describe('Validation Schema (lib/validation/customer.ts)', () => {
    test('requires name', () => {
      const res = customerSchema.safeParse({ name: '' });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error.issues.some((i) => i.path[0] === 'name'));
      }
    });


    test('validates email format or empty string', () => {
      assert.strictEqual(customerSchema.safeParse({ name: 'C', email: '' }).success, true);
      assert.strictEqual(customerSchema.safeParse({ name: 'C', email: 'c@example.com' }).success, true);
      assert.strictEqual(customerSchema.safeParse({ name: 'C', email: 'not-an-email' }).success, false);
    });
  });

  describe('Customer Actions & Scoping', () => {
    let customerA1Id: string;
    let customerA2Id: string;
    let customerB1Id: string;

    test('createCustomer: creates customer scoped to authenticated user', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res1 = await createCustomer({
        name: 'Alpha Corp',
        email: 'billing@alpha.com',
        phone: '09171112233',
        address: 'Makati City',
        notes: 'VIP Client',
      });

      assert.strictEqual(res1.ok, true);
      if (res1.ok) {
        customerA1Id = res1.data.id;
        assert.strictEqual(res1.data.name, 'Alpha Corp');
        assert.strictEqual(res1.data.userId, userAId);
        assert.strictEqual(res1.data.archived, false);
      }

      const res2 = await createCustomer({
        name: 'Beta LLC',
        email: 'info@beta.ph',
      });
      assert.strictEqual(res2.ok, true);
      if (res2.ok) {
        customerA2Id = res2.data.id;
      }
    });

    test('createCustomer for User B', async () => {
      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const res = await createCustomer({
        name: 'User B Client',
        email: 'client@b.com',
      });

      assert.strictEqual(res.ok, true);
      if (res.ok) {
        customerB1Id = res.data.id;
      }
    });

    test('getCustomers: returns only the authenticated user customers', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await getCustomers();
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.length, 2);
        assert.ok(res.data.every((c) => c.userId === userAId));
        assert.ok(!res.data.some((c) => c.id === customerB1Id));
      }
    });

    test('getCustomers: search filter works by name and email', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const resSearch = await getCustomers({ search: 'alpha' });
      assert.strictEqual(resSearch.ok, true);
      if (resSearch.ok) {
        assert.strictEqual(resSearch.data.length, 1);
        assert.strictEqual(resSearch.data[0].name, 'Alpha Corp');
      }

      const resSearchEmail = await getCustomers({ search: 'beta.ph' });
      assert.strictEqual(resSearchEmail.ok, true);
      if (resSearchEmail.ok) {
        assert.strictEqual(resSearchEmail.data.length, 1);
        assert.strictEqual(resSearchEmail.data[0].name, 'Beta LLC');
      }
    });

    test('getCustomer: returns customer for owner and null/unauthorized for another user', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const resOwner = await getCustomer(customerA1Id);
      assert.strictEqual(resOwner.ok, true);
      if (resOwner.ok) {
        assert.ok(resOwner.data);
        assert.strictEqual(resOwner.data.id, customerA1Id);
        assert.strictEqual(resOwner.data.name, 'Alpha Corp');
      }

      // User B cannot access User A's customer
      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const resOther = await getCustomer(customerA1Id);
      assert.strictEqual(resOther.ok, true);
      if (resOther.ok) {
        assert.strictEqual(resOther.data, null);
      }
    });

    test('updateCustomer: updates customer fields scoped to owner', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await updateCustomer(customerA1Id, {
        name: 'Alpha Corp Philippines',
        email: 'billing@alpha.ph',
        address: 'BGC, Taguig',
      });

      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.name, 'Alpha Corp Philippines');
        assert.strictEqual(res.data.email, 'billing@alpha.ph');
      }

      // User B cannot update User A's customer
      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const resUnauthorized = await updateCustomer(customerA1Id, {
        name: 'Hacked Alpha',
      });
      assert.strictEqual(resUnauthorized.ok, false);
      assert.match(resUnauthorized.error, /not found/i);
    });

    test('archiveCustomer: archives customer without hard-deleting (AGENTS.md §4)', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await archiveCustomer(customerA2Id, true);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.archived, true);
      }

      // Record STILL exists in MongoDB (never hard-deleted)
      const doc = await Customer.findById(customerA2Id);
      assert.ok(doc);
      assert.strictEqual(doc.archived, true);

      // Default getCustomers hides archived
      const resActive = await getCustomers();
      assert.strictEqual(resActive.ok, true);
      if (resActive.ok) {
        assert.strictEqual(resActive.data.length, 1);
        assert.strictEqual(resActive.data[0].id, customerA1Id);
      }

      // getCustomers with includeArchived: true returns both
      const resAll = await getCustomers({ includeArchived: true });
      assert.strictEqual(resAll.ok, true);
      if (resAll.ok) {
        assert.strictEqual(resAll.data.length, 2);
        assert.ok(resAll.data.some((c) => c.id === customerA2Id && c.archived === true));
      }
    });

    test('archiving a customer referenced by a sent document leaves snapshot intact', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      // Create a sent document with a snapshot of customerA1
      const quotation = await Quotation.create({
        userId: userAId,
        customerId: customerA1Id,
        number: 'QUO-000001',
        status: 'SENT',
        customerSnapshot: {
          name: 'Alpha Corp Philippines',
          email: 'billing@alpha.ph',
          address: 'BGC, Taguig',
        },
        businessSnapshot: {
          businessName: 'My Company',
          address: 'Manila',
          email: 'me@company.com',
          phone: '09170000000',
          logoUrl: null,
        },
        items: [
          {
            description: 'Consulting',
            quantity: 1,
            unitPriceCentavos: 100000,
            amountCentavos: 100000,
          },
        ],
        subtotalCentavos: 100000,
        discountCentavos: 0,
        totalCentavos: 100000,
        issueDate: new Date(),
        validUntil: new Date(Date.now() + 86400000 * 30),
      });

      // Archive the referenced customer
      const resArchive = await archiveCustomer(customerA1Id, true);
      assert.strictEqual(resArchive.ok, true);

      // Verify the quotation document is intact with frozen snapshot
      const loadedQuotation = await Quotation.findById(quotation._id);
      assert.ok(loadedQuotation);
      assert.strictEqual(loadedQuotation.status, 'SENT');
      assert.strictEqual(loadedQuotation.customerSnapshot?.name, 'Alpha Corp Philippines');
      assert.strictEqual(loadedQuotation.customerSnapshot?.email, 'billing@alpha.ph');
      assert.strictEqual(loadedQuotation.customerId?.toString(), customerA1Id);
    });
  });
});
