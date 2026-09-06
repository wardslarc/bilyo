import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';
import { Product } from '../models/product.ts';
import { Business } from '../models/business.ts';
import { Customer } from '../models/customer.ts';
import { productSchema } from '../lib/validation/product.ts';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
} from '../actions/products.ts';
import { getBusinessProfile, saveBusinessProfile } from '../actions/business.ts';
import { getCustomers, createCustomer } from '../actions/customers.ts';
import { setAuthGetter } from '../lib/auth-guards.ts';

describe('Products CRUD (M2-T04)', () => {
  const userAEmail = `prod-a-${Date.now()}@example.com`;
  const userBEmail = `prod-b-${Date.now()}@example.com`;
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
      plan: 'FREE',
      planSource: 'DEFAULT',
    });
    userAId = userA._id.toString();

    const userB = await User.create({
      email: userBEmail,
      passwordHash: hash,
      name: 'User B',
      role: 'USER',
      plan: 'FREE',
      planSource: 'DEFAULT',
    });
    userBId = userB._id.toString();
  });

  after(async () => {
    await Product.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Customer.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Business.deleteMany({ userId: { $in: [userAId, userBId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await mongoose.disconnect();
  });

  describe('Validation Schema (lib/validation/product.ts)', () => {
    test('requires name', () => {
      const res = productSchema.safeParse({ name: '', unitPrice: '100' });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error.issues.some((i) => i.path[0] === 'name'));
      }
    });

    test('accepts peso string "1,234.56" and converts to 123456 centavos', () => {
      const res = productSchema.safeParse({
        name: 'Web Dev',
        unitPrice: '1,234.56',
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.unitPrice, 123456);
      }
    });

    test('rounds half-up deliberately at 3rd decimal "1234.565" -> 123457 centavos', () => {
      const res = productSchema.safeParse({
        name: 'Design',
        unitPrice: '1234.565',
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.unitPrice, 123457);
      }
    });

    test('rejects negative or invalid price inputs', () => {
      assert.strictEqual(
        productSchema.safeParse({ name: 'X', unitPrice: '-50' }).success,
        false
      );
      assert.strictEqual(
        productSchema.safeParse({ name: 'X', unitPrice: 'invalid' }).success,
        false
      );
    });
  });

  describe('Product Actions & Scoping', () => {
    let productA1Id: string;
    let productA2Id: string;
    let productB1Id: string;

    test('createProduct: creates product with integer centavos scoped to User A', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res1 = await createProduct({
        name: 'Hourly Consulting',
        description: 'Strategy and architecture advisory',
        unitPrice: '2,500.00',
        unit: 'hr',
      });

      assert.strictEqual(res1.ok, true);
      if (res1.ok) {
        productA1Id = res1.data.id;
        assert.strictEqual(res1.data.name, 'Hourly Consulting');
        assert.strictEqual(res1.data.unitPriceCentavos, 250000);
        assert.strictEqual(res1.data.unit, 'hr');
        assert.strictEqual(res1.data.userId, userAId);
        assert.strictEqual(res1.data.archived, false);
      }

      const res2 = await createProduct({
        name: 'Monthly SEO Package',
        description: 'Technical audits and rank tracking',
        unitPrice: '15,000.00',
        unit: 'month',
      });
      assert.strictEqual(res2.ok, true);
      if (res2.ok) {
        productA2Id = res2.data.id;
        assert.strictEqual(res2.data.unitPriceCentavos, 1500000);
      }
    });

    test('createProduct for User B', async () => {
      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const res = await createProduct({
        name: 'User B Service',
        unitPrice: '500.00',
      });
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        productB1Id = res.data.id;
      }
    });

    test('getProducts: returns only authenticated user products', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const res = await getProducts();
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.length, 2);
        assert.ok(res.data.every((p) => p.userId === userAId));
        assert.ok(!res.data.some((p) => p.id === productB1Id));
      }
    });

    test('getProducts: search filter on name and description', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const resName = await getProducts({ search: 'hourly' });
      assert.strictEqual(resName.ok, true);
      if (resName.ok) {
        assert.strictEqual(resName.data.length, 1);
        assert.strictEqual(resName.data[0].name, 'Hourly Consulting');
      }

      const resDesc = await getProducts({ search: 'audits' });
      assert.strictEqual(resDesc.ok, true);
      if (resDesc.ok) {
        assert.strictEqual(resDesc.data.length, 1);
        assert.strictEqual(resDesc.data[0].name, 'Monthly SEO Package');
      }
    });

    test('getProduct: returns product for owner and null for other users', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const resOwner = await getProduct(productA1Id);
      assert.strictEqual(resOwner.ok, true);
      if (resOwner.ok) {
        assert.ok(resOwner.data);
        assert.strictEqual(resOwner.data.id, productA1Id);
      }

      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const resOther = await getProduct(productA1Id);
      assert.strictEqual(resOther.ok, true);
      if (resOther.ok) {
        assert.strictEqual(resOther.data, null);
      }
    });

    test('updateProduct: updates fields and recalculated centavos scoped to owner', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const resUpdate = await updateProduct(productA1Id, {
        name: 'Senior Hourly Consulting',
        unitPrice: '3,000.00',
        unit: 'hour',
      });

      assert.strictEqual(resUpdate.ok, true);
      if (resUpdate.ok) {
        assert.strictEqual(resUpdate.data.name, 'Senior Hourly Consulting');
        assert.strictEqual(resUpdate.data.unitPriceCentavos, 300000);
        assert.strictEqual(resUpdate.data.unit, 'hour');
      }

      // User B cannot update User A's product
      setAuthGetter(async () => ({
        user: { id: userBId, email: userBEmail, role: 'USER' },
      }));

      const resUnauthorized = await updateProduct(productA1Id, {
        name: 'Hacked Item',
        unitPrice: '1.00',
      });
      assert.strictEqual(resUnauthorized.ok, false);
      assert.match(resUnauthorized.error, /not found/i);
    });

    test('archiveProduct: archives product without hard-deleting (AGENTS.md §4)', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      const resArchive = await archiveProduct(productA2Id, true);
      assert.strictEqual(resArchive.ok, true);
      if (resArchive.ok) {
        assert.strictEqual(resArchive.data.archived, true);
      }

      // Record still exists in MongoDB
      const doc = await Product.findById(productA2Id);
      assert.ok(doc);
      assert.strictEqual(doc.archived, true);

      // Default getProducts hides archived
      const resActive = await getProducts();
      assert.strictEqual(resActive.ok, true);
      if (resActive.ok) {
        assert.strictEqual(resActive.data.length, 1);
        assert.strictEqual(resActive.data[0].id, productA1Id);
      }

      // getProducts with includeArchived: true returns both
      const resAll = await getProducts({ includeArchived: true });
      assert.strictEqual(resAll.ok, true);
      if (resAll.ok) {
        assert.strictEqual(resAll.data.length, 2);
        assert.ok(resAll.data.some((p) => p.id === productA2Id && p.archived === true));
      }
    });
  });

  describe('Milestone 2 Acceptance: profile, 3 customers, and 3 products survive reload', () => {
    test('profile, 3 customers, and 3 products are intact and survive re-login simulation', async () => {
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      // 1. Business Profile
      await saveBusinessProfile({
        businessName: 'Apex Creative Lab',
        address: 'Ortigas Center, Pasig City',
        email: 'billing@apexlab.ph',
        phone: '09175556677',
        tin: '555-666-777-000',
        vatRegistered: true,
      });

      // 2. Three Customers
      await createCustomer({ name: 'Client 1 - San Miguel', email: 'sm@example.com' });
      await createCustomer({ name: 'Client 2 - Ayala Corp', email: 'ayala@example.com' });
      await createCustomer({ name: 'Client 3 - Globe Telecom', email: 'globe@example.com' });

      // 3. Three Products
      await createProduct({ name: 'UI/UX Design Sprint', unitPrice: '50,000.00', unit: 'project' });
      await createProduct({ name: 'Frontend Engineering', unitPrice: '3,500.00', unit: 'hr' });
      await createProduct({ name: 'Cloud Infrastructure Setup', unitPrice: '25,000.00', unit: 'setup' });

      // Simulate re-login / new request context
      setAuthGetter(async () => ({
        user: { id: userAId, email: userAEmail, role: 'USER' },
      }));

      // Verify Business Profile
      const profile = await getBusinessProfile();
      assert.strictEqual(profile.ok, true);
      assert.strictEqual(profile.data?.businessName, 'Apex Creative Lab');
      assert.strictEqual(profile.data?.vatRegistered, true);

      // Verify Customers
      const customers = await getCustomers();
      assert.strictEqual(customers.ok, true);
      assert.ok(customers.data && customers.data.length >= 3);
      const customerNames = customers.data.map((c) => c.name);
      assert.ok(customerNames.includes('Client 1 - San Miguel'));
      assert.ok(customerNames.includes('Client 2 - Ayala Corp'));
      assert.ok(customerNames.includes('Client 3 - Globe Telecom'));

      // Verify Products
      const products = await getProducts();
      assert.strictEqual(products.ok, true);
      assert.ok(products.data && products.data.length >= 3);
      const productNames = products.data.map((p) => p.name);
      assert.ok(productNames.includes('UI/UX Design Sprint'));
      assert.ok(productNames.includes('Frontend Engineering'));
      assert.ok(productNames.includes('Cloud Infrastructure Setup'));
    });
  });
});
