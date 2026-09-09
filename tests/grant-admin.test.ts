import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { User } from '../models/user.ts';

const execAsync = promisify(exec);

describe('Admin Bootstrap Script (M1-T07)', () => {
  const testEmail = `grant-admin-${Date.now()}@example.com`;
  let userId: string;

  before(async () => {
    await dbConnect();
    const user = await User.create({
      email: testEmail,
      passwordHash: 'dummy_hash',
      name: 'Admin Test Target',
      role: 'USER',
    });
    userId = user._id.toString();
  });

  after(async () => {
    await User.deleteOne({ _id: userId });
    await mongoose.disconnect();
  });

  test('grant-admin without email argument exits non-zero with usage message', async () => {
    try {
      await execAsync('node --env-file=.env.local scripts/grant-admin.ts');
      assert.fail('Expected script to exit with non-zero code');
    } catch (err: unknown) {
      const execError = err as { code?: number; stderr?: string };
      assert.notStrictEqual(execError.code, 0);
      assert.ok(execError.stderr?.includes('Usage: npm run grant-admin -- <email>'));
    }
  });

  test('grant-admin on non-existent email exits non-zero with error message', async () => {
    const nonexistent = `nonexistent-${Date.now()}@example.com`;
    try {
      await execAsync(`node --env-file=.env.local scripts/grant-admin.ts ${nonexistent}`);
      assert.fail('Expected script to exit with non-zero code');
    } catch (err: unknown) {
      const execError = err as { code?: number; stderr?: string };
      assert.notStrictEqual(execError.code, 0);
      assert.ok(execError.stderr?.includes(`User with email "${nonexistent}" not found`));
    }
  });

  test('grant-admin promotes USER to ADMIN in database and prints reminder', async () => {
    // Confirm starting role is USER
    const beforeUser = await User.findById(userId);
    assert.strictEqual(beforeUser?.role, 'USER');

    const { stdout } = await execAsync(`node --env-file=.env.local scripts/grant-admin.ts ${testEmail}`);
    assert.ok(stdout.includes(`Successfully granted ADMIN role to "${testEmail}"`));
    assert.ok(stdout.includes('ADMIN_EMAILS'));

    // Confirm database was updated
    const afterUser = await User.findById(userId);
    assert.strictEqual(afterUser?.role, 'ADMIN');
  });

  test('grant-admin is idempotent when run again on the same user', async () => {
    const { stdout } = await execAsync(`node --env-file=.env.local scripts/grant-admin.ts ${testEmail}`);
    assert.ok(stdout.includes(`User "${testEmail}" already has role ADMIN.`));
    assert.ok(stdout.includes('ADMIN_EMAILS'));

    const user = await User.findById(userId);
    assert.strictEqual(user?.role, 'ADMIN');
  });

  test('invariant: no code path in app/ or actions/ writes user.role', () => {
    const projectRoot = process.cwd();
    const dirsToCheck = ['app', 'actions'];

    function scanDir(dir: string): string[] {
      const fullPath = path.join(projectRoot, dir);
      if (!fs.existsSync(fullPath)) return [];
      let results: string[] = [];
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanDir(path.join(dir, entry.name)));
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          results.push(entryPath);
        }
      }
      return results;
    }

    for (const dir of dirsToCheck) {
      const files = scanDir(dir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        // Check for mutation patterns on role (e.g. role = 'ADMIN', $set: { role: ... })
        assert.strictEqual(
          /\.role\s*=\s*['"`]ADMIN['"`]/.test(content),
          false,
          `Forbidden role write found in ${file}`
        );
        assert.strictEqual(
          /\$set:\s*\{[^}]*role:/.test(content),
          false,
          `Forbidden role update found in ${file}`
        );
      }
    }
  });
});
