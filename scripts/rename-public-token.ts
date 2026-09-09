/**
 * One-Off Migration Script: Rename Public Token to Public Code (§6.7, §19, P2-T02)
 *
 * Copies publicToken → publicCode and publicTokenRevokedAt → publicCodeRevokedAt
 * for all existing quotations in the collection. Ensures publicCode index is created.
 *
 * Run manually before deploying P2-T02:
 *   npx tsx scripts/rename-public-token.ts
 *   or:
 *   node --env-file=.env.local scripts/rename-public-token.ts
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { Quotation } from '../models/quotation.ts';

async function main() {
  console.log('--- Rename Public Token to Public Code Migration (P2-T02) ---');

  try {
    await dbConnect();
    const collection = Quotation.collection;

    // 1. Find quotations that have a publicToken but no publicCode
    const filter = {
      publicToken: { $exists: true, $ne: null },
      $or: [{ publicCode: { $exists: false } }, { publicCode: null }],
    };

    const countToMigrate = await collection.countDocuments(filter);
    console.log(`Found ${countToMigrate} quotations with publicToken to copy to publicCode.`);

    if (countToMigrate > 0) {
      // 2. Perform pipeline update to copy publicToken -> publicCode and publicTokenRevokedAt -> publicCodeRevokedAt
      const result = await collection.updateMany(filter, [
        {
          $set: {
            publicCode: '$publicToken',
            publicCodeRevokedAt: '$publicTokenRevokedAt',
          },
        },
      ]);
      console.log(`✓ Successfully updated ${result.modifiedCount} quotations.`);
    } else {
      console.log('All quotations with publicToken already have publicCode set.');
    }

    // 3. Ensure the unique sparse index on publicCode exists
    console.log('Ensuring sparse unique index on publicCode...');
    await collection.createIndex(
      { publicCode: 1 },
      { unique: true, sparse: true, name: 'publicCode_1' }
    );
    console.log('✓ Sparse unique index publicCode_1 ensured.');

    console.log('\nMigration completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\nMigration failed with error:', error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

main();
