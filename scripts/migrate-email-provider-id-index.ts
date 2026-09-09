/**
 * One-Off Migration Script: Fix EmailMessage providerId Unique Index
 *
 * 1. Unsets explicit null values for providerId in emailmessages collection
 * 2. Drops existing providerId_1 index (which conflicts on nulls)
 * 3. Recreates providerId_1 index with unique: true, sparse: true, and
 *    partialFilterExpression: { providerId: { $type: 'string' } }
 *
 * Run manually:
 *   node --env-file=.env.local scripts/migrate-email-provider-id-index.ts
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { EmailMessage } from '../models/email-message.ts';

async function main() {
  console.log('--- EmailMessage providerId Index Migration ---');

  try {
    await dbConnect();
    const collection = EmailMessage.collection;

    // 1. Unset providerId where it is null or not a string
    console.log('\nCleaning up null providerId values...');
    const unsetResult = await collection.updateMany(
      { providerId: null },
      { $unset: { providerId: '' } }
    );
    console.log(`✓ Unset providerId on ${unsetResult.modifiedCount} documents.`);

    // 2. Inspect current indexes
    const initialIndexes = await collection.indexes();
    console.log('\nCurrent indexes on emailmessages:');
    for (const idx of initialIndexes) {
      console.log(` - ${idx.name}:`, JSON.stringify(idx.key));
    }

    // 3. Drop existing providerId_1 index if present
    const oldIndex = initialIndexes.find((idx) => idx.name === 'providerId_1');
    if (oldIndex) {
      console.log('\nDropping obsolete providerId_1 index...');
      await collection.dropIndex('providerId_1');
      console.log('✓ Dropped providerId_1');
    }

    // 4. Recreate with partialFilterExpression
    console.log('\nCreating new providerId_1 index with partialFilterExpression for strings...');
    await collection.createIndex(
      { providerId: 1 },
      {
        name: 'providerId_1',
        unique: true,
        partialFilterExpression: { providerId: { $type: 'string' } },
      }
    );
    console.log('✓ Created index providerId_1 with string partial filter');

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
