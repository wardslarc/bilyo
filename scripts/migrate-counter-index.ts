/**
 * One-Off Migration Script: Migrate Counter Index (§6.3, P2-T01)
 *
 * Replaces the obsolete counter unique index { userId: 1, kind: 1 }
 * with the new yearly compound unique index { userId: 1, kind: 1, year: 1 }.
 *
 * Run manually before deploying quotation core changes:
 *   npx tsx scripts/migrate-counter-index.ts
 *   or:
 *   node --env-file=.env.local scripts/migrate-counter-index.ts
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.ts';
import { Counter } from '../models/counter.ts';
import { getManilaYear } from '../lib/dates.ts';

async function main() {
  console.log('--- Counter Index Migration (P2-T01) ---');

  try {
    await dbConnect();
    const collection = Counter.collection;

    // 1. Fetch current indexes
    const initialIndexes = await collection.indexes();
    console.log('Current indexes on counters collection:');
    for (const idx of initialIndexes) {
      console.log(` - ${idx.name}:`, JSON.stringify(idx.key));
    }

    // 2. Drop old index if present
    const oldIndexName = 'userId_1_kind_1';
    const oldIndex = initialIndexes.find((idx) => idx.name === oldIndexName);

    if (oldIndex) {
      console.log(`\nDropping obsolete index: ${oldIndexName}...`);
      await collection.dropIndex(oldIndexName);
      console.log(`✓ Dropped ${oldIndexName}`);
    } else {
      console.log(`\nNo obsolete index ${oldIndexName} found (may already have been dropped).`);
    }

    // 3. Backfill missing `year` field on existing counter records if any
    const missingYearCount = await Counter.countDocuments({ year: { $exists: false } });
    if (missingYearCount > 0) {
      console.log(`\nFound ${missingYearCount} counter documents missing 'year' field. Backfilling...`);
      const defaultYear = getManilaYear(new Date());
      const updateResult = await Counter.updateMany(
        { year: { $exists: false } },
        { $set: { year: defaultYear } }
      );
      console.log(`✓ Backfilled ${updateResult.modifiedCount} documents with year=${defaultYear}`);
    } else {
      console.log('\nAll existing counter documents have a valid year field.');
    }

    // 4. Create new compound unique index: { userId: 1, kind: 1, year: 1 }
    const newIndexName = 'userId_1_kind_1_year_1';
    console.log(`\nCreating new compound unique index: ${newIndexName}...`);
    await collection.createIndex(
      { userId: 1, kind: 1, year: 1 },
      { unique: true, name: newIndexName }
    );
    console.log(`✓ Created index ${newIndexName}`);

    // 5. Verify final index state
    const finalIndexes = await collection.indexes();
    console.log('\nFinal indexes on counters collection:');
    for (const idx of finalIndexes) {
      console.log(` - ${idx.name}:`, JSON.stringify(idx.key));
    }

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
